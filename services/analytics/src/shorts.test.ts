// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { ShortsEvent } from "../../../lib/analytics/shorts-contract";
import type { AnalyticsDatabase } from "./database";
import { handleShorts } from "./shorts";

const visitorId = "22222222-2222-4222-8222-222222222222";
const sessionId = "11111111-1111-4111-8111-111111111111";
const pageViewId = "33333333-3333-4333-8333-333333333333";

const isTemplateCall = (value: unknown): value is TemplateStringsArray => Array.isArray(value) && "raw" in value;

function shortsEvent(overrides: Partial<ShortsEvent> = {}): ShortsEvent {
  return {
    event_id: "44444444-4444-4444-8444-444444444444",
    visitor_id: visitorId,
    session_id: sessionId,
    page_view_id: pageViewId,
    event_name: "page_view",
    occurred_at: new Date().toISOString(),
    sequence: 1,
    path: "/",
    element_id: null,
    active_ms: null,
    referrer_host: null,
    device: "desktop",
    is_test: false,
    ...overrides,
  };
}

function request(path: string, init?: RequestInit) {
  return new Request(`http://analytics${path}`, init);
}

function jsonPost(path: string, body: unknown) {
  return request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function fakeSql(responses: unknown[]) {
  const tx = vi.fn((firstArg: unknown) => isTemplateCall(firstArg) ? responses.shift() : { rows: firstArg });
  const sql = { begin: vi.fn(async (...args: unknown[]) => {
    const callback = typeof args[0] === "function" ? args[0] as (tx: typeof tx) => unknown : args[1] as (tx: typeof tx) => unknown;
    return callback(tx);
  }) } as unknown as AnalyticsDatabase;
  return { sql, tx };
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("shorts blocker analytics service handler", () => {
  it("accepts a valid event batch and reports insert count after conflict handling", async () => {
    const click = shortsEvent({
      event_id: "55555555-5555-4555-8555-555555555555",
      event_name: "element_click",
      sequence: 2,
      element_id: "support",
    });
    const { sql, tx } = fakeSql([[{ event_id: click.event_id }]]);

    const response = await handleShorts(jsonPost("/internal/products/shorts-blocker-kids/events", { events: [shortsEvent(), click] }), sql);

    expect(response.status).toBe(200);
    await expect(body(response)).resolves.toEqual({ accepted: 2, inserted: 1 });
    const bulkCall = tx.mock.calls.find(([firstArg]) => !isTemplateCall(firstArg));
    expect(bulkCall?.[0]).toHaveLength(2);
    expect(bulkCall?.[0][1]).toMatchObject({ event_name: "element_click", element_id: "support" });
  });

  it("rejects unsafe event writes before opening a transaction", async () => {
    const { sql } = fakeSql([]);

    expect((await handleShorts(jsonPost("/internal/products/shorts-blocker-kids/events?debug=1", { events: [shortsEvent()] }), sql)).status).toBe(400);
    expect((await handleShorts(jsonPost("/internal/products/shorts-blocker-kids/events", { events: [shortsEvent({ occurred_at: new Date(Date.now() - 25 * 3600_000).toISOString() })] }), sql)).status).toBe(400);
    expect((await handleShorts(jsonPost("/internal/products/shorts-blocker-kids/events", { events: [{ ...shortsEvent(), extra: true }] }), sql)).status).toBe(400);
    expect(sql.begin).not.toHaveBeenCalled();
  });

  it("builds a bounded report and truncates a selected session event stream", async () => {
    const now = new Date("2026-01-10T12:00:00.000Z");
    const event = {
      event_id: "66666666-6666-4666-8666-666666666666",
      event_name: "page_view",
      occurred_at: now,
      path: "/",
      element_id: null,
      active_ms: null,
    };
    const session = {
      session_id: sessionId,
      visitor_id: visitorId,
      first_at: new Date("2026-01-10T11:00:00.000Z"),
      last_at: now,
      views: 2,
      clicks: 1,
    };
    const { sql } = fakeSql([
      [{ now }],
      [{ history_available_from: new Date("2026-01-01T00:00:00.000Z"), last_received_at: now }],
      [{ visitors: 1, sessions: 1, page_views: 2, clicks: 1 }],
      [{ path: "/", views: 2, clicks: 1 }],
      [{ element_id: "support", clicks: 1 }],
      [{ host: null, sessions: 1 }],
      [session],
      Array.from({ length: 1001 }, (_, index) => ({ ...event, event_id: `${String(index).padStart(8, "0")}-6666-4666-8666-666666666666` })),
    ]);

    const response = await handleShorts(request(`/internal/products/shorts-blocker-kids/report?days=30&page=2&session=${sessionId}`, { method: "GET" }), sql);

    expect(response.status).toBe(200);
    const report = await body(response);
    expect(report).toMatchObject({
      product_id: "shorts-blocker-kids",
      days: 30,
      page: 2,
      selected_session: sessionId,
      events_truncated: true,
    });
    expect(report.events).toHaveLength(1000);
    expect(sql.begin).toHaveBeenCalledWith("isolation level repeatable read read only", expect.any(Function));
  });

  it.each([
    "/internal/products/shorts-blocker-kids/report?days=14",
    "/internal/products/shorts-blocker-kids/report?page=0",
    "/internal/products/shorts-blocker-kids/report?page=100001",
    "/internal/products/shorts-blocker-kids/report?session=not-a-uuid",
    "/internal/products/shorts-blocker-kids/report?days=7&extra=1",
    "/internal/products/shorts-blocker-kids/report?days=7&days=30",
  ])("rejects invalid report query %s", async path => {
    const { sql } = fakeSql([]);
    const response = await handleShorts(request(path, { method: "GET" }), sql);

    expect(response.status).toBe(400);
    await expect(body(response)).resolves.toEqual({ error: "invalid_query" });
    expect(sql.begin).not.toHaveBeenCalled();
  });

  it("returns not found for unsupported shorts routes", async () => {
    const response = await handleShorts(request("/internal/products/shorts-blocker-kids/events", { method: "GET" }), fakeSql([]).sql);

    expect(response.status).toBe(404);
    await expect(body(response)).resolves.toEqual({ error: "NOT_FOUND" });
  });
});
