// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readAnalyticsSession, readAnalyticsOverview, readAnalyticsSessions, sendAnalyticsEvents } from "./analytics-service-client";
import { parseAnalyticsBatch } from "@/lib/analytics/contract";
import { syntheticEvent, TEST_ID } from "@/lib/analytics/fixtures.test-support";
vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("ANALYTICS_SERVICE_URL", "http://analytics:3100"); vi.stubEnv("ANALYTICS_SERVICE_KEY", "synthetic-private-key-at-least-32-bytes");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ accepted: 1, inserted: 1, duplicates: 0 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
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
it("rejects invalid acknowledgements and foreign session responses", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ accepted: 1, inserted: 0, duplicates: 0 }));
  await expect(sendAnalyticsEvents(parseAnalyticsBatch({ events: [syntheticEvent()] }, "browser"), "browser")).rejects.toThrow();
  vi.mocked(fetch).mockResolvedValue(Response.json({ session_id: "foreign", events: [] }));
  await expect(readAnalyticsSession(TEST_ID)).rejects.toThrow();
});

it("rejects wrong report periods and missing counts instead of manufacturing zero", async () => {
  const overview = {
    product_id: "deutschmit", generated_at: "2026-09-13T12:00:00Z", period_start: "2026-09-07T00:00:00Z",
    last_received_at: null, history_available_from: null, days: 7,
    totals: { visitors: 0, sessions: 0, page_views: 0, telegram_clicks: 0, analytics_conversions: 0 },
    daily_series: [], top_pages: [],
  };
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
