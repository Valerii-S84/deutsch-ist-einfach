// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { syntheticEvent, TEST_ID } from "../../../lib/analytics/fixtures.test-support";
import type { AnalyticsDatabase } from "./database";

const mocks = vi.hoisted(() => ({
  insertEvents: vi.fn(),
  readOverview: vi.fn(),
  readSession: vi.fn(),
  readSessions: vi.fn(),
  readPages: vi.fn(),
  readEvents: vi.fn(),
  readTraffic: vi.fn(),
  readConversions: vi.fn(),
  handleShorts: vi.fn(),
}));

vi.mock("./database", () => ({ insertEvents: mocks.insertEvents }));
vi.mock("./reports", () => ({ readOverview: mocks.readOverview, readSession: mocks.readSession, readSessions: mocks.readSessions }));
vi.mock("./application-reports", () => ({
  readPages: mocks.readPages,
  readEvents: mocks.readEvents,
  readTraffic: mocks.readTraffic,
  readConversions: mocks.readConversions,
}));
vi.mock("./shorts", () => ({ handleShorts: mocks.handleShorts }));

import { createAnalyticsHandler } from "./app";

const key = "synthetic-service-key-32-characters";
const auth = { authorization: `Bearer ${key}` };
const jsonHeaders = { ...auth, "content-type": "application/json" };

async function readBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("analytics internal HTTP handler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.insertEvents.mockResolvedValue({ accepted: 1, inserted: 1, duplicates: 0 });
    mocks.readOverview.mockResolvedValue({ report: "overview" });
    mocks.readSession.mockResolvedValue({ report: "session" });
    mocks.readSessions.mockResolvedValue({ report: "sessions" });
    mocks.readPages.mockResolvedValue({ report: "pages" });
    mocks.readEvents.mockResolvedValue({ report: "events" });
    mocks.readTraffic.mockResolvedValue({ report: "traffic" });
    mocks.readConversions.mockResolvedValue({ report: "conversions" });
    mocks.handleShorts.mockResolvedValue(Response.json({ report: "shorts" }));
  });

  it("requires a configured key and authorization before touching storage", async () => {
    expect(() => createAnalyticsHandler(vi.fn() as unknown as AnalyticsDatabase, "short")).toThrow("analytics_key_not_configured");

    const sql = vi.fn() as unknown as AnalyticsDatabase;
    const response = await createAnalyticsHandler(sql, key)(new Request("http://analytics/health"));

    expect(response.status).toBe(401);
    await expect(readBody(response)).resolves.toEqual({ error: "AUTH_REQUIRED" });
    expect(sql).not.toHaveBeenCalled();
  });

  it("serves health checks only with a clean GET query", async () => {
    const sql = vi.fn().mockResolvedValue([{ ok: 1 }]) as unknown as AnalyticsDatabase;
    const handler = createAnalyticsHandler(sql, key);

    const response = await handler(new Request("http://analytics/health", { headers: auth }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(readBody(response)).resolves.toEqual({ ok: true });

    const invalid = await handler(new Request("http://analytics/health?probe=1", { headers: auth }));
    expect(invalid.status).toBe(400);
    await expect(readBody(invalid)).resolves.toEqual({ error: "invalid_query" });
  });

  it("validates browser/server event ingestion before inserting", async () => {
    const sql = vi.fn() as unknown as AnalyticsDatabase;
    const handler = createAnalyticsHandler(sql, key);
    const browserEvent = syntheticEvent("page_view");

    const accepted = await handler(new Request("http://analytics/internal/events/browser", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ events: [browserEvent] }),
    }));

    expect(accepted.status).toBe(200);
    expect(mocks.insertEvents).toHaveBeenCalledWith(
      sql,
      [expect.objectContaining({ event_name: "page_view", path: "/" })],
      "browser",
    );
    await expect(readBody(accepted)).resolves.toEqual({ accepted: 1, inserted: 1, duplicates: 0 });

    const wrongSource = await handler(new Request("http://analytics/internal/events/server", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ events: [browserEvent] }),
    }));
    expect(wrongSource.status).toBe(400);
    await expect(readBody(wrongSource)).resolves.toEqual({ error: "invalid_payload" });

    const withQuery = await handler(new Request("http://analytics/internal/events/browser?debug=1", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ events: [browserEvent] }),
    }));
    expect(withQuery.status).toBe(400);
  });

  it.each([
    ["/internal/products/deutschmit/overview", mocks.readOverview],
    ["/internal/products/deutschmit/pages", mocks.readPages],
    ["/internal/products/deutschmit/events", mocks.readEvents],
    ["/internal/products/deutschmit/traffic", mocks.readTraffic],
    ["/internal/products/deutschmit/conversions", mocks.readConversions],
  ])("routes %s reports with validated days", async (path, reader) => {
    const sql = vi.fn() as unknown as AnalyticsDatabase;
    const response = await createAnalyticsHandler(sql, key)(new Request(`http://analytics${path}?days=90`, { headers: auth }));

    expect(response.status).toBe(200);
    expect(reader).toHaveBeenCalledWith(sql, 90);
  });

  it("passes normalized session filters and parsed selections to reports", async () => {
    const sql = vi.fn() as unknown as AnalyticsDatabase;
    const selection = { kind: "intent", destination: "telegram" };
    const response = await createAnalyticsHandler(sql, key)(new Request(
      `http://analytics/internal/products/deutschmit/sessions?days=30&page=2&path=%2Fwissen&event_name=page_view&selection=${encodeURIComponent(JSON.stringify(selection))}`,
      { headers: auth },
    ));

    expect(response.status).toBe(200);
    expect(mocks.readSessions).toHaveBeenCalledWith(sql, {
      days: 30,
      page: 2,
      path: "/wissen",
      eventName: "page_view",
      selection,
    });
  });

  it.each([
    "/internal/products/deutschmit/overview?days=14",
    "/internal/products/deutschmit/overview?days=7&days=30",
    "/internal/products/deutschmit/sessions?page=0",
    "/internal/products/deutschmit/sessions?path=external",
    "/internal/products/deutschmit/sessions?event_name=made_up",
    "/internal/products/deutschmit/sessions?selection=%7Bbad",
    "/internal/products/deutschmit/pages?days=7&extra=1",
  ])("rejects invalid report query %s", async path => {
    const response = await createAnalyticsHandler(vi.fn() as unknown as AnalyticsDatabase, key)(new Request(`http://analytics${path}`, { headers: auth }));

    expect(response.status).toBe(400);
    await expect(readBody(response)).resolves.toEqual({ error: "invalid_report_query" });
  });

  it("serves session details only for clean UUID paths", async () => {
    const sql = vi.fn() as unknown as AnalyticsDatabase;
    const handler = createAnalyticsHandler(sql, key);

    expect((await handler(new Request(`http://analytics/internal/products/deutschmit/sessions/${TEST_ID}`, { headers: auth }))).status).toBe(200);
    expect(mocks.readSession).toHaveBeenCalledWith(sql, TEST_ID);
    expect((await handler(new Request("http://analytics/internal/products/deutschmit/sessions/not-a-uuid", { headers: auth }))).status).toBe(400);
    expect((await handler(new Request(`http://analytics/internal/products/deutschmit/sessions/${TEST_ID}?days=7`, { headers: auth }))).status).toBe(400);
  });

  it("delegates shorts routes, maps body errors, storage errors and unknown routes", async () => {
    const sql = vi.fn() as unknown as AnalyticsDatabase;
    const handler = createAnalyticsHandler(sql, key);

    expect((await handler(new Request("http://analytics/internal/products/shorts-blocker-kids/report", { headers: auth }))).status).toBe(200);
    expect(mocks.handleShorts).toHaveBeenCalledWith(expect.any(Request), sql);

    const mediaType = await handler(new Request("http://analytics/internal/events/browser", {
      method: "POST",
      headers: auth,
      body: "{}",
    }));
    expect(mediaType.status).toBe(415);
    await expect(readBody(mediaType)).resolves.toEqual({ error: "unsupported_media_type" });

    mocks.readPages.mockRejectedValueOnce(new Error("database down"));
    const unavailable = await handler(new Request("http://analytics/internal/products/deutschmit/pages", { headers: auth }));
    expect(unavailable.status).toBe(503);
    await expect(readBody(unavailable)).resolves.toEqual({ error: "analytics_unavailable" });

    const missing = await handler(new Request("http://analytics/internal/missing", { headers: auth }));
    expect(missing.status).toBe(404);
    await expect(readBody(missing)).resolves.toEqual({ error: "NOT_FOUND" });
  });
});
