// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { TEST_ID } from "@/lib/analytics/fixtures.test-support";
import { createSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { readAnalyticsSession } from "@/lib/server/analytics-service-client";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-service-client", () => ({ readAnalyticsSession: vi.fn(), AnalyticsServiceError: class extends Error { status = 503; } }));
beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", "site@example.test"); vi.stubEnv("SITE_ADMIN_PASSWORD", "synthetic-password"); vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "synthetic-signing-key-at-least-32-bytes");
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
function request(token?: string, query = "") { return new NextRequest(`https://site.example.test/api/admin/analytics/sessions/${TEST_ID}${query}`, { headers: token ? { Cookie: `${SITE_ADMIN_SESSION_COOKIE}=${token}` } : {} }); }
it.each([undefined, "forged"])("denies %s before any service call", async token => {
  expect((await GET(request(token), { params: Promise.resolve({ sessionId: TEST_ID }) })).status).toBe(401);
  expect(readAnalyticsSession).not.toHaveBeenCalled();
});
it("allows only a session UUID and fixed product with a valid owner session", async () => {
  const token = createSiteAdminSession("site@example.test", "synthetic-password")!;
  expect((await GET(request(token, "?product=quiz-arena"), { params: Promise.resolve({ sessionId: TEST_ID }) })).status).toBe(400);
  expect((await GET(request(token), { params: Promise.resolve({ sessionId: "../../foreign" }) })).status).toBe(400);
  expect(readAnalyticsSession).not.toHaveBeenCalled();
  vi.mocked(readAnalyticsSession).mockResolvedValue({ session_id: TEST_ID } as never);
  const response = await GET(request(token), { params: Promise.resolve({ sessionId: TEST_ID }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  vi.mocked(readAnalyticsSession).mockRejectedValue(new Error("private upstream body"));
  const failed = await GET(request(token), { params: Promise.resolve({ sessionId: TEST_ID }) });
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("private");
});
