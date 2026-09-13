// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { readAnalyticsOverview } from "@/lib/server/analytics-service-client";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-service-client", () => ({
  readAnalyticsOverview: vi.fn(),
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
  return new NextRequest(`https://site.example.test/api/admin/analytics/deutschmit/overview${query}`, {
    headers: token ? { Cookie: `${SITE_ADMIN_SESSION_COOKIE}=${token}` } : {},
  });
}

describe("deutschmit analytics overview API", () => {
  it("checks the owner session before reading analytics", async () => {
    expect((await GET(request("?days=30"))).status).toBe(401);
    expect(readAnalyticsOverview).not.toHaveBeenCalled();
  });

  it.each(["?days=14", "?days=7&days=30", "?source=legacy"]) ("rejects invalid query %s", async query => {
    const token = createSiteAdminSession("site@example.test", "synthetic-password")!;
    expect((await GET(request(query, token))).status).toBe(400);
    expect(readAnalyticsOverview).not.toHaveBeenCalled();
  });

  it("reads the requested period and returns private no-store data", async () => {
    const token = createSiteAdminSession("site@example.test", "synthetic-password")!;
    vi.mocked(readAnalyticsOverview).mockResolvedValue({ days: 30 } as never);
    const response = await GET(request("?days=30", token));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(readAnalyticsOverview).toHaveBeenCalledExactlyOnceWith(30);
    expect(await response.json()).toEqual({ days: 30 });
  });
});
