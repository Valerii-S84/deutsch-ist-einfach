// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ANALYTICS_PRODUCT } from "../../../lib/analytics/contract";
import type { ReportSelection } from "../../../lib/analytics/report-selection";
import type { AnalyticsDatabase } from "./database";
import { readConversions, readEvents, readPages, readTraffic, selectionPredicate } from "./application-reports";
import { readOverview, readSession, readSessions } from "./reports";

const generatedAt = new Date("2026-01-10T12:00:00.000Z");
const periodStart = new Date("2026-01-04T00:00:00.000Z");
const lastReceivedAt = new Date("2026-01-10T12:01:00.000Z");
const visitorId = "22222222-2222-4222-8222-222222222222";
const sessionId = "11111111-1111-4111-8111-111111111111";

const isTemplateCall = (value: unknown): value is TemplateStringsArray => Array.isArray(value) && "raw" in value;

function sqlRows(rows: unknown[]) {
  return vi.fn((firstArg: unknown) => isTemplateCall(firstArg) ? Promise.resolve(rows) : { rows: firstArg }) as unknown as AnalyticsDatabase;
}

function meta() {
  return {
    generated_at: generatedAt,
    period_start: periodStart,
    last_received_at: lastReceivedAt,
    history_available_from: null,
  };
}

function summary() {
  return {
    session_id: sessionId,
    started_at: "2026-01-10T11:00:00.000Z",
    last_activity_at: "2026-01-10T11:10:00.000Z",
    status: "timed_out",
    incomplete: false,
    first_page: "/",
    last_page: "/wissen",
    entry_source: "direct",
    page_views: 2,
    active_ms: 60000,
    telegram_clicks: 1,
    analytics_conversions: 0,
    quiz_completions: 0,
    event_count: 4,
    outcome: "telegram_click",
  };
}

function sessionEvent() {
  return {
    product_id: ANALYTICS_PRODUCT,
    event_id: "33333333-3333-4333-8333-333333333333",
    event_name: "page_view",
    schema_version: 1,
    visitor_id: visitorId,
    session_id: sessionId,
    page_view_id: "44444444-4444-4444-8444-444444444444",
    sequence: 1,
    occurred_at: "2026-01-10T11:00:00.000Z",
    path: "/",
    metadata: {},
    source: "browser",
    received_at: "2026-01-10T11:00:01.000Z",
  };
}

describe("analytics report readers", () => {
  it("parses application report envelopes from database rows", async () => {
    await expect(readPages(sqlRows([{ ...meta(), items: [{ path: "/wissen", page_views: 2, visitors: 1, measured_views: 1, average_active_ms: 60000, max_scroll: 90, article_reads: 1 }] }]), 7))
      .resolves.toMatchObject({ product_id: ANALYTICS_PRODUCT, days: 7, generated_at: generatedAt.toISOString(), items: [{ path: "/wissen", page_views: 2 }] });
    await expect(readEvents(sqlRows([{ ...meta(), events: [{ event_name: "page_view", count: 2 }], elements: [{ element_id: "telegram_cta", placement: "hero", impressions: 2, clicks: 1, matched_click_views: 1, unmatched_clicks: 0 }], errors: [{ error_code: "unknown_error", component_id: "app", count: 1 }] }]), 30))
      .resolves.toMatchObject({ days: 30, events: [{ event_name: "page_view", count: 2 }] });
    await expect(readTraffic(sqlRows([{ ...meta(), items: [{ referrer_host: null, utm_source: "newsletter", utm_medium: "email", utm_campaign: "Launch", source_kind: "attributed", sessions: 3, converted_sessions: 1, analytics_conversions: 1 }] }]), 90))
      .resolves.toMatchObject({ days: 90, items: [{ source_kind: "attributed", sessions: 3 }] });
    await expect(readConversions(sqlRows([{ ...meta(), forms: [{ form_id: "student", opens: 2, submits: 1, successes: 1, errors: 0 }], quizzes: [{ quiz_id: "daily", starts: 1, completions: 1 }], intents: [{ destination: "telegram", clicks: 1 }] }]), 7))
      .resolves.toMatchObject({ forms: [{ form_id: "student", successes: 1 }], intents: [{ destination: "telegram", clicks: 1 }] });
  });

  it("rejects malformed application report rows instead of returning partial contracts", async () => {
    await expect(readConversions(sqlRows([{ ...meta(), forms: [{ form_id: "student", opens: -1, submits: 0, successes: 0, errors: 0 }], quizzes: [], intents: [] }]), 7))
      .rejects.toThrow();
  });

  it("accepts every strict session selector shape as a predicate fragment", () => {
    const sql = vi.fn(() => ({ fragment: true })) as unknown as AnalyticsDatabase;
    const selectors: Array<ReportSelection | undefined> = [
      undefined,
      { kind: "page", path: "/wissen" },
      { kind: "event", event_name: "article_read" },
      { kind: "element", element_id: "telegram_cta", placement: "hero" },
      { kind: "error", error_code: "unknown_error", component_id: "app" },
      { kind: "form", form_id: "student", event_name: "form_success" },
      { kind: "quiz", quiz_id: "daily", event_name: "quiz_completed" },
      { kind: "intent", destination: "telegram" },
      { kind: "traffic", referrer_host: null, utm_source: "newsletter", utm_medium: "email", utm_campaign: "Launch" },
    ];

    for (const selector of selectors) expect(selectionPredicate(sql, selector)).toEqual({ fragment: true });
  });

  it("parses overview reports and fails closed when the database returns no row", async () => {
    const row = {
      ...meta(),
      totals: { visitors: 2, sessions: 3, page_views: 4, telegram_clicks: 1, analytics_conversions: 1 },
      daily_series: [{ date: "2026-01-10", visitors: 2, sessions: 3, page_views: 4, telegram_clicks: 1, analytics_conversions: 1 }],
      top_pages: [{ path: "/wissen", page_views: 2, unique_visitors: 1, telegram_clicks: 1 }],
    };

    await expect(readOverview(sqlRows([row]), 7)).resolves.toMatchObject({
      product_id: ANALYTICS_PRODUCT,
      generated_at: generatedAt.toISOString(),
      totals: row.totals,
    });
    await expect(readOverview(sqlRows([]), 7)).rejects.toThrow("analytics_report_empty");
  });

  it("parses session lists with stable pagination metadata and filters", async () => {
    const selection = { kind: "page", path: "/wissen" } as const;

    await expect(readSessions(sqlRows([{ ...meta(), total: 51, items: [summary()] }]), {
      days: 30,
      page: 2,
      path: "/wissen",
      eventName: "page_view",
      selection,
    })).resolves.toMatchObject({
      product_id: ANALYTICS_PRODUCT,
      days: 30,
      page: 2,
      page_size: 50,
      pages: 2,
      filters: { path: "/wissen", event_name: "page_view", selection },
      items: [summary()],
    });
  });

  it("fails closed for missing or invalid session list rows", async () => {
    await expect(readSessions(sqlRows([]), { days: 7, page: 1 })).rejects.toThrow("analytics_sessions_empty");
    await expect(readSessions(sqlRows([{ ...meta(), items: [] }]), { days: 7, page: 1 })).rejects.toThrow("analytics_sessions_invalid");
  });

  it("normalizes requested session IDs before reading detail rows", async () => {
    await expect(readSession(sqlRows([{ generated_at: generatedAt.toISOString(), last_received_at: null, history_available_from: null, summary: summary(), events: [sessionEvent()] }]), sessionId.toUpperCase()))
      .resolves.toMatchObject({ product_id: ANALYTICS_PRODUCT, session_id: sessionId, summary: summary(), events: [sessionEvent()] });
    await expect(readSession(sqlRows([]), "not-a-uuid")).rejects.toThrow();
  });
});
