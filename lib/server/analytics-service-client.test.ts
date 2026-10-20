// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AnalyticsServiceError,
  readAnalyticsConversions,
  readAnalyticsEvents,
  readAnalyticsOverview,
  readAnalyticsPages,
  readAnalyticsSession,
  readAnalyticsSessions,
  readAnalyticsTraffic,
  sendAnalyticsEvents,
} from "./analytics-service-client";
import { parseAnalyticsBatch } from "@/lib/analytics/contract";
import { syntheticEvent, TEST_ID } from "@/lib/analytics/fixtures.test-support";
vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("ANALYTICS_SERVICE_URL", "http://analytics:3100"); vi.stubEnv("ANALYTICS_SERVICE_KEY", "synthetic-private-key-at-least-32-bytes");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ accepted: 1, inserted: 1, duplicates: 0 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const overview = {
  product_id: "deutschmit", generated_at: "2026-09-13T12:00:00Z", period_start: "2026-09-07T00:00:00Z",
  last_received_at: null, history_available_from: null, days: 7,
  totals: { visitors: 0, sessions: 0, page_views: 0, telegram_clicks: 0, analytics_conversions: 0 },
  daily_series: [], top_pages: [],
};
const reportMeta = {
  product_id: "deutschmit", generated_at: "2026-09-13T12:00:00Z", period_start: "2026-09-07T00:00:00Z",
  last_received_at: null, history_available_from: null, days: 7,
};
const summary = {
  session_id: TEST_ID,
  started_at: "2026-09-13T11:00:00Z",
  last_activity_at: null,
  status: "unknown",
  incomplete: true,
  first_page: null,
  last_page: null,
  entry_source: "direct",
  page_views: 0,
  active_ms: null,
  telegram_clicks: 0,
  analytics_conversions: 0,
  quiz_completions: 0,
  event_count: 1,
  outcome: "none",
};
it("uses a fixed internal route and a server key, no browser cookies or redirects", async () => {
  await sendAnalyticsEvents(parseAnalyticsBatch({ events: [syntheticEvent()] }, "browser"), "browser");
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("http://analytics:3100/internal/events/browser");
  expect(init).toMatchObject({ redirect: "error", cache: "no-store", headers: { Authorization: "Bearer synthetic-private-key-at-least-32-bytes" } });
  expect(new Headers(init?.headers).has("cookie")).toBe(false);
});
it("does not forward invalid server/browser event mixes", async () => {
  const events = parseAnalyticsBatch({ events: [syntheticEvent("form_success")] }, "server");
  await expect(sendAnalyticsEvents(events, "browser")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it.each([401, 403, 500, 503])("maps upstream %s to unavailable without leaking details", async status => {
  vi.mocked(fetch).mockResolvedValue(new Response("private upstream error", { status }));
  await expect(readAnalyticsSession(TEST_ID)).rejects.toMatchObject({ status: 503, message: "analytics_unavailable" });
});
it.each([400, 413, 422, 429])("preserves retry-relevant upstream %s status", async status => {
  vi.mocked(fetch).mockResolvedValue(new Response("private upstream error", { status }));
  await expect(readAnalyticsOverview(7)).rejects.toMatchObject({ status, message: "analytics_unavailable" });
});

it("fails closed before fetch for missing keys or unsafe service URLs", async () => {
  vi.stubEnv("ANALYTICS_SERVICE_KEY", "");
  await expect(readAnalyticsOverview(7)).rejects.toBeInstanceOf(AnalyticsServiceError);
  expect(fetch).not.toHaveBeenCalled();

  vi.stubEnv("ANALYTICS_SERVICE_KEY", "synthetic-private-key-at-least-32-bytes");
  for (const url of ["ftp://analytics/", "http://user@analytics/", "http://analytics/path", "http://analytics/?x=1", "http://analytics/#hash"]) {
    vi.mocked(fetch).mockClear();
    vi.stubEnv("ANALYTICS_SERVICE_URL", url);
    await expect(readAnalyticsOverview(7)).rejects.toThrow("analytics_unavailable");
    expect(fetch).not.toHaveBeenCalled();
  }
});

it("rejects empty, oversized and non-json service responses", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
  await expect(readAnalyticsOverview(7)).rejects.toThrow("analytics_unavailable");

  vi.mocked(fetch).mockResolvedValueOnce(new Response("not json"));
  await expect(readAnalyticsOverview(7)).rejects.toThrow("analytics_unavailable");

  const huge = JSON.stringify({ ok: "x".repeat(2 * 1024 * 1024 + 1) });
  vi.mocked(fetch).mockResolvedValueOnce(new Response(huge));
  await expect(readAnalyticsOverview(7)).rejects.toThrow("analytics_unavailable");
});

it("sends valid server events to the short-timeout server ingestion route", async () => {
  const events = parseAnalyticsBatch({ events: [syntheticEvent("form_success")] }, "server");

  await expect(sendAnalyticsEvents(events, "server")).resolves.toEqual({ accepted: 1, inserted: 1, duplicates: 0 });
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("http://analytics:3100/internal/events/server");
  expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
});
it("rejects invalid acknowledgements and foreign session responses", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ accepted: 1, inserted: 0, duplicates: 0 }));
  await expect(sendAnalyticsEvents(parseAnalyticsBatch({ events: [syntheticEvent()] }, "browser"), "browser")).rejects.toThrow();
  vi.mocked(fetch).mockResolvedValue(Response.json({ session_id: "foreign", events: [] }));
  await expect(readAnalyticsSession(TEST_ID)).rejects.toThrow();
});

it("rejects wrong report periods and missing counts instead of manufacturing zero", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(overview));
  await expect(readAnalyticsOverview(30)).rejects.toThrow("analytics_unavailable");
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...overview, totals: { ...overview.totals, visitors: null } }));
  await expect(readAnalyticsOverview(7)).rejects.toThrow("analytics_unavailable");
});

it("encodes session filters and rejects a response for another filter", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({
    product_id: "deutschmit", generated_at: "2026-09-13T12:00:00Z", period_start: "2026-09-07T00:00:00Z",
    last_received_at: null, history_available_from: null, days: 7, page: 2, pages: 1, page_size: 50, total: 0,
    filters: { path: "/wissen", event_name: "form_open" }, items: [],
  }));
  await expect(readAnalyticsSessions({ days: 7, page: 2, path: "/contact", eventName: "form_open" })).rejects.toThrow("analytics_unavailable");
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe("http://analytics:3100/internal/products/deutschmit/sessions?days=7&page=2&path=%2Fcontact&event_name=form_open");
});

it("accepts matching session filters and selection while rejecting foreign nested session IDs", async () => {
  const selection = { kind: "intent", destination: "telegram" } as const;
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({
    product_id: "deutschmit", generated_at: "2026-09-13T12:00:00Z", period_start: "2026-09-07T00:00:00Z",
    last_received_at: null, history_available_from: null, days: 30, page: 3, pages: 1, page_size: 50, total: 0,
    filters: { path: null, event_name: null, selection }, items: [],
  }));
  await expect(readAnalyticsSessions({ days: 30, page: 3, selection })).resolves.toMatchObject({ filters: { selection } });
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("selection=%7B%22kind%22%3A%22intent%22");

  vi.mocked(fetch).mockResolvedValueOnce(Response.json({
    product_id: "deutschmit",
    session_id: TEST_ID,
    generated_at: "2026-09-13T12:00:00Z",
    last_received_at: null,
    history_available_from: null,
    summary: { ...summary, session_id: "22222222-2222-4222-8222-222222222222" },
    events: [],
  }));
  await expect(readAnalyticsSession(TEST_ID)).rejects.toThrow("analytics_unavailable");
});

it("parses stored browser and server events on session detail responses", async () => {
  const browser = parseAnalyticsBatch({ events: [syntheticEvent("page_view")] }, "browser")[0];
  const server = parseAnalyticsBatch({ events: [syntheticEvent("form_success")] }, "server")[0];
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({
    product_id: "deutschmit",
    session_id: TEST_ID,
    generated_at: "2026-09-13T12:00:00Z",
    last_received_at: "2026-09-13T12:00:01Z",
    history_available_from: "2026-09-01T00:00:00Z",
    summary,
    events: [{ ...browser, source: "browser", received_at: "2026-09-13T12:00:01Z" }, { ...server, source: "server", received_at: "2026-09-13T12:00:02Z" }],
  }));

  await expect(readAnalyticsSession(TEST_ID)).resolves.toMatchObject({ session_id: TEST_ID, events: [{ source: "browser" }, { source: "server" }] });

  vi.mocked(fetch).mockResolvedValueOnce(Response.json({
    product_id: "deutschmit",
    session_id: TEST_ID,
    generated_at: "2026-09-13T12:00:00Z",
    last_received_at: null,
    history_available_from: null,
    summary: null,
    events: [{ ...browser, source: "server", received_at: "2026-09-13T12:00:01Z" }],
  }));
  await expect(readAnalyticsSession(TEST_ID)).rejects.toThrow("analytics_unavailable");
});

it("parses every application report endpoint and rejects mismatched report days", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ ...reportMeta, items: [{ path: "/wissen", page_views: 1, visitors: 1, measured_views: 0, average_active_ms: null, max_scroll: null, article_reads: 0 }] }))
    .mockResolvedValueOnce(Response.json({ ...reportMeta, events: [{ event_name: "page_view", count: 1 }], elements: [], errors: [] }))
    .mockResolvedValueOnce(Response.json({ ...reportMeta, items: [{ referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null, source_kind: "direct", sessions: 1, converted_sessions: 0, analytics_conversions: 0 }] }))
    .mockResolvedValueOnce(Response.json({ ...reportMeta, forms: [{ form_id: "student", opens: 1, submits: 1, successes: 0, errors: 0 }], quizzes: [], intents: [{ destination: "telegram", clicks: 0 }] }))
    .mockResolvedValueOnce(Response.json({ ...reportMeta, days: 30, items: [] }));

  await expect(readAnalyticsPages(7)).resolves.toMatchObject({ items: [{ path: "/wissen" }] });
  await expect(readAnalyticsEvents(7)).resolves.toMatchObject({ events: [{ event_name: "page_view" }] });
  await expect(readAnalyticsTraffic(7)).resolves.toMatchObject({ items: [{ source_kind: "direct" }] });
  await expect(readAnalyticsConversions(7)).resolves.toMatchObject({ forms: [{ form_id: "student" }] });
  await expect(readAnalyticsPages(7)).rejects.toThrow("analytics_unavailable");
});
