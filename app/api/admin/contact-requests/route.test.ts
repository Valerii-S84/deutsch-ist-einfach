// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSiteAdminSession } from "@/lib/server/site-admin-auth";
import { readSiteContactRequests, updateSiteContactStatus } from "@/lib/server/contact-store";
import { GET, PATCH } from "./route";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/contact-store", () => ({ CONTACT_REQUEST_STATUSES: ["NEW", "IN_PROGRESS", "DONE", "SPAM"], readSiteContactRequests: vi.fn(), updateSiteContactStatus: vi.fn() }));
const id = "1689d573-2a28-44c8-a1ff-4c04fbf43c49";
function request(method = "GET", body?: unknown, origin = "http://localhost", authenticated = true) {
  const token = authenticated ? createSiteAdminSession("owner@example.test", "synthetic-password") : "forged";
  return new NextRequest("http://localhost/api/admin/contact-requests", { method, headers: { origin, cookie: `site_admin_session=${token}` }, body: body ? JSON.stringify(body) : undefined });
}
beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", "owner@example.test"); vi.stubEnv("SITE_ADMIN_PASSWORD", "synthetic-password"); vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "synthetic-signing-secret-at-least-32-bytes");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No bot dependency allowed"); }));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("restored site contacts administration", () => {
  it("rejects unauthorized reads and writes before touching data", async () => {
    expect((await GET(request("GET", undefined, undefined, false))).status).toBe(401);
    expect((await PATCH(request("PATCH", {}, undefined, false))).status).toBe(401);
    expect(readSiteContactRequests).not.toHaveBeenCalled(); expect(updateSiteContactStatus).not.toHaveBeenCalled();
  });
  it("reads an explicit zero while bot is offline", async () => {
    vi.mocked(readSiteContactRequests).mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
    const response = await GET(request());
    expect(await response.json()).toEqual({ items: [], total: 0, page: 1, pages: 1 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("distinguishes storage failure from no requests", async () => {
    vi.mocked(readSiteContactRequests).mockRejectedValue(new Error("private"));
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
  });
  it.each(["NEW", "IN_PROGRESS", "DONE", "SPAM"] as const)("updates %s with optimistic concurrency and confirmed result", async status => {
    vi.mocked(updateSiteContactStatus).mockResolvedValue({ id, status });
    const response = await PATCH(request("PATCH", { id, status, expected_status: "NEW" }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ id, status });
    expect(updateSiteContactStatus).toHaveBeenCalledWith(id, status, "NEW"); expect(fetch).not.toHaveBeenCalled();
  });
  it("denies cross-origin changes and malformed IDs", async () => {
    expect((await PATCH(request("PATCH", { id, status: "DONE", expected_status: "NEW" }, "https://evil.test"))).status).toBe(403);
    expect((await PATCH(request("PATCH", { id: "1 OR 1=1", status: "DONE", expected_status: "NEW" }))).status).toBe(400);
    expect(updateSiteContactStatus).not.toHaveBeenCalled();
  });
  it("reports concurrent change or missing record without claiming success", async () => {
    vi.mocked(updateSiteContactStatus).mockResolvedValue(null);
    expect((await PATCH(request("PATCH", { id, status: "DONE", expected_status: "NEW" }))).status).toBe(409);
  });
});
