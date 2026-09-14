// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { createSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { readSiteAnalyticsOverview } from "@/lib/server/site-analytics-store";

import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/site-analytics-store", () => ({ readSiteAnalyticsOverview: vi.fn() }));

const overview = {
  generated_at: "2026-09-07T12:00:00.000Z",
  days: 7,
  totals: { page_views_total: 12, unique_visitors_total: 4, telegram_cta_clicks_total: 2 },
  daily_series: [],
  top_pages: [],
};

function request(query = "", cookie = `${SITE_ADMIN_SESSION_COOKIE}=${createSiteAdminSession("admin@example.com", "site-test-password")}`) {
  return new NextRequest(`http://localhost/api/admin/website-analytics/overview${query}`, {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", "admin@example.com");
  vi.stubEnv("SITE_ADMIN_PASSWORD", "site-test-password");
  vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "test-signing-key-with-at-least-32-bytes");
  vi.mocked(readSiteAnalyticsOverview).mockImplementation(async (days) => ({ ...overview, days }));
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("site analytics overview API", () => {
  it.each(["", "session=external", `${SITE_ADMIN_SESSION_COOKIE}=forged`])("rejects missing or rejected sessions before reading storage (%s)", async (cookie) => {
    const response = await GET(request("", cookie));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTH_REQUIRED" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(readSiteAnalyticsOverview).not.toHaveBeenCalled();
  });

  it.each([7, 30, 90])("reads %s days from the site store after checking the session", async (days) => {
    const response = await GET(request(`?days=${days}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...overview, days });
    expect(readSiteAnalyticsOverview).toHaveBeenCalledExactlyOnceWith(days);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("defaults to seven days", async () => {
    expect((await GET(request())).status).toBe(200);
    expect(readSiteAnalyticsOverview).toHaveBeenCalledWith(7);
  });

  it.each(["", "-1", "0", "8", "7d", "7.5", "1000000"])("rejects an invalid period %s", async (days) => {
    expect((await GET(request(`?days=${days}`))).status).toBe(400);
    expect(readSiteAnalyticsOverview).not.toHaveBeenCalled();
  });

  it("returns a bounded public error when site storage fails", async () => {
    vi.mocked(readSiteAnalyticsOverview).mockRejectedValue(new Error("private database details"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "analytics_unavailable" });
  });
});

it("routes configured historical data to the cookie-scoped Quiz Arena gateway", async () => {
  vi.stubEnv("SITE_LEGACY_ANALYTICS_SOURCE", "quiz-arena");
  const response = await GET(request("?days=90"));
  expect(response.status).toBe(307);
  expect(response.headers.get("Location")).toBe("/api/admin/quiz-arena/website-analytics/overview?days=90");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(readSiteAnalyticsOverview).not.toHaveBeenCalled();
});
