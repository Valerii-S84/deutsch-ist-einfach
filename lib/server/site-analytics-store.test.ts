import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteAnalyticsEventPayload } from "@/lib/site-analytics-contract";

const postgresMocks = vi.hoisted(() => {
  const json = vi.fn((value: unknown) => ({ json: value }));
  const query = Object.assign(vi.fn(), { json });
  const postgres = vi.fn(() => query);

  return { json, postgres, query };
});

vi.mock("postgres", () => ({ default: postgresMocks.postgres }));

const databaseUrl = "postgresql://site-user:site-pass@site-db/site";
const originalDatabaseUrl = process.env.DATABASE_URL;

const pageViewPayload: SiteAnalyticsEventPayload = {
  event_type: "page_view",
  visitor_id: "1234567890abcdef",
  path: "/wissen",
  referrer: "example.com/start",
  utm_source: "newsletter",
  utm_medium: "email",
  utm_campaign: "september",
  timestamp: "2026-09-03T10:00:00.000Z",
};

const telegramClickPayload: SiteAnalyticsEventPayload = {
  event_type: "telegram_cta_click",
  visitor_id: "abcdef1234567890",
  path: "/",
  timestamp: "2026-09-03T10:05:00.000Z",
  metadata: {
    public_event_name: "hero_cta_click",
    section: "hero",
    cta: "telegram_bot",
    destination: "telegram_bot",
    question_index: 3,
    score: 2,
    article_slug: null,
  },
};

function getInsertCall() {
  expect(postgresMocks.query).toHaveBeenCalledOnce();

  const [strings, ...values] = postgresMocks.query.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  const text = strings.join("?").replace(/\s+/g, " ").trim();

  return { text, values };
}

async function loadStore() {
  return import("./site-analytics-store");
}

beforeEach(() => {
  vi.resetModules();
  process.env.DATABASE_URL = databaseUrl;
  postgresMocks.json.mockClear();
  postgresMocks.postgres.mockClear();
  postgresMocks.query.mockReset();
  postgresMocks.query.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("site analytics store", () => {
  it.each([
    [7, "2026-08-29T00:00:00.000Z"],
    [30, "2026-08-06T00:00:00.000Z"],
    [90, "2026-06-07T00:00:00.000Z"],
  ])("bounds the %s-day overview to UTC calendar days through the current instant", async (days, start) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T15:30:00.000Z"));
    const overview = {
      generated_at: "2026-09-04T15:30:00.000Z",
      days,
      totals: { page_views_total: 12, unique_visitors_total: 2, telegram_cta_clicks_total: 3 },
      daily_series: [],
      top_pages: [],
    };
    postgresMocks.query.mockResolvedValue([{ overview }]);
    const { readSiteAnalyticsOverview } = await loadStore();

    await expect(readSiteAnalyticsOverview(days)).resolves.toEqual(overview);
    const { values } = getInsertCall();
    expect(values).toEqual([start, overview.generated_at, overview.generated_at, days]);
  });

  it("does not create a database connection for an unsupported overview period", async () => {
    const { readSiteAnalyticsOverview } = await loadStore();
    await expect(readSiteAnalyticsOverview(365)).rejects.toThrow("Invalid analytics period");
    expect(postgresMocks.postgres).not.toHaveBeenCalled();
  });

  it("propagates overview storage failures to the protected route", async () => {
    postgresMocks.query.mockRejectedValue(new Error("database unavailable"));
    const { readSiteAnalyticsOverview } = await loadStore();
    await expect(readSiteAnalyticsOverview(7)).rejects.toThrow("database unavailable");
  });

  it("inserts a page_view into website_analytics_events", async () => {
    const { saveSiteAnalyticsEvent } = await loadStore();

    await saveSiteAnalyticsEvent(pageViewPayload);

    const { text, values } = getInsertCall();
    expect(text).toContain("INSERT INTO website_analytics_events");
    expect(text).toContain(
      "event_type, visitor_id, path, referrer, utm_source, utm_medium, utm_campaign, event_timestamp, metadata",
    );
    expect(values.slice(0, 8)).toEqual([
      "page_view",
      pageViewPayload.visitor_id,
      "/wissen",
      "example.com/start",
      "newsletter",
      "email",
      "september",
      "2026-09-03T10:00:00.000Z",
    ]);
  });

  it("inserts a telegram_cta_click", async () => {
    const { saveSiteAnalyticsEvent } = await loadStore();

    await saveSiteAnalyticsEvent(telegramClickPayload);

    const { values } = getInsertCall();
    expect(values[0]).toBe("telegram_cta_click");
    expect(values[1]).toBe(telegramClickPayload.visitor_id);
    expect(values[2]).toBe("/");
    expect(values[7]).toBe("2026-09-03T10:05:00.000Z");
  });

  it("writes absent optional fields as NULL", async () => {
    const { saveSiteAnalyticsEvent } = await loadStore();

    await saveSiteAnalyticsEvent({
      event_type: "page_view",
      visitor_id: "nullable12345678",
      path: "/books",
      timestamp: "2026-09-03T11:00:00.000Z",
    });

    const { values } = getInsertCall();
    expect(values.slice(3, 7)).toEqual([null, null, null, null]);
    expect(values[8]).toBeNull();
    expect(postgresMocks.json).not.toHaveBeenCalled();
  });

  it("serializes metadata as jsonb through the PostgreSQL client", async () => {
    const { saveSiteAnalyticsEvent } = await loadStore();

    await saveSiteAnalyticsEvent(telegramClickPayload);

    const { values } = getInsertCall();
    expect(postgresMocks.json).toHaveBeenCalledOnce();
    expect(postgresMocks.json).toHaveBeenCalledWith(telegramClickPayload.metadata);
    expect(values[8]).toEqual({ json: telegramClickPayload.metadata });
  });

  it("creates the PostgreSQL client from DATABASE_URL", async () => {
    const { saveSiteAnalyticsEvent } = await loadStore();

    await saveSiteAnalyticsEvent(pageViewPayload);

    expect(postgresMocks.postgres).toHaveBeenCalledOnce();
    expect(postgresMocks.postgres).toHaveBeenCalledWith(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  });

  it("uses tagged-template parameters instead of interpolating payload values", async () => {
    const { saveSiteAnalyticsEvent } = await loadStore();

    await saveSiteAnalyticsEvent(pageViewPayload);

    const { text, values } = getInsertCall();
    expect(text).toMatch(/VALUES \( \?(?:, \?){8} \)/);
    expect(text).not.toContain(pageViewPayload.visitor_id);
    expect(text).not.toContain(pageViewPayload.path);
    expect(values).toHaveLength(9);
  });

  it("rejects when the database insert fails", async () => {
    const databaseError = new Error("database unavailable");
    postgresMocks.query.mockRejectedValue(databaseError);
    const { saveSiteAnalyticsEvent } = await loadStore();

    await expect(saveSiteAnalyticsEvent(pageViewPayload)).rejects.toBe(
      databaseError,
    );
  });
});
