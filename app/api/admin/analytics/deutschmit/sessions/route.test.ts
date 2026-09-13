// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { readAnalyticsSessions } from "@/lib/server/analytics-service-client";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-service-client", () => ({
  readAnalyticsSessions: vi.fn(),
  AnalyticsServiceError: class extends Error { status = 503; },
}));

beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", "site@example.test");
  vi.stubEnv("SITE_ADMIN_PASSWORD", "synthetic-password");
  vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "synthetic-signing-key-at-least-32-bytes");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function request(query = "", token?: string) {
  return new NextRequest(`https://site.example.test/api/admin/analytics/deutschmit/sessions${query}`, {
    headers: token ? { Cookie: `${SITE_ADMIN_SESSION_COOKIE}=${token}` } : {},
  });
}

describe("deutschmit analytics sessions API", () => {
  it("checks the owner session before reading analytics", async () => {
    expect((await GET(request("?days=30"))).status).toBe(401);
    expect(readAnalyticsSessions).not.toHaveBeenCalled();
  });

  it.each(["?days=14", "?page=0", "?path=/admin/users", "?event_name=not-an-event", "?days=7&unknown=x"]) ("rejects invalid query %s", async query => {
    const token = createSiteAdminSession("site@example.test", "synthetic-password")!;
    expect((await GET(request(query, token))).status).toBe(400);
    expect(readAnalyticsSessions).not.toHaveBeenCalled();
  });

  it("forwards fixed, normalized filters and returns private no-store data", async () => {
    const token = createSiteAdminSession("site@example.test", "synthetic-password")!;
    vi.mocked(readAnalyticsSessions).mockResolvedValue({ page: 2 } as never);
    const response = await GET(request("?days=30&page=2&path=%2Fcontact&event_name=form_open", token));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(readAnalyticsSessions).toHaveBeenCalledExactlyOnceWith({ days: 30, page: 2, path: "/contact", eventName: "form_open" });
    expect(await response.json()).toEqual({ page: 2 });
  });
});
