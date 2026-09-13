// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSiteAdminSession } from "./site-admin-auth";
import { allowedQuizRoute, proxyQuizArena } from "./quiz-arena-proxy";
vi.mock("server-only", () => ({}));
let siteToken: string;
let backend: ReturnType<typeof vi.fn>;
function req(path: string, method = "GET", cookie = `site_admin_session=${siteToken}`, origin = "http://localhost") {
  return new NextRequest(`http://localhost/api/admin/quiz-arena/${path}`, { method, headers: { cookie, origin }, ...(method !== "GET" ? { body: "{}" } : {}) });
}
beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", "owner@example.test");
  vi.stubEnv("SITE_ADMIN_PASSWORD", "synthetic-test-password");
  vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "synthetic-signing-secret-at-least-32-bytes");
  vi.stubEnv("QUIZ_ARENA_ADMIN_URL", "https://quiz.example.test/api");
  siteToken = createSiteAdminSession("owner@example.test", "synthetic-test-password")!;
  backend = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", backend);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Quiz Arena isolated server boundary", () => {
  it("preserves backend bigint IDs through the proxy", async () => {
    backend.mockResolvedValue(new Response('{"id":9223372036854775807}'));
    const result = await proxyQuizArena(req("promo/9223372036854775807"), "promo/9223372036854775807");
    expect(await result.json()).toEqual({ id: "9223372036854775807" });
  });
  it("does not overwrite a rotated session from an in-flight read", async () => {
    const result = await proxyQuizArena(req("users"), "users");
    expect(result.headers.get("set-cookie")).toBeNull();
  });
  it.each(["", "site_admin_session=forged"])("rejects missing/forged site auth", async (cookie) => {
    expect((await proxyQuizArena(req("users", "GET", cookie), "users")).status).toBe(401);
    expect(backend).not.toHaveBeenCalled();
  });
  it.each(["../system", "website-analytics/overview", "contact", "https://evil.test", "promo/0", "users/delete"])("denies unknown route %s", async path => {
    expect((await proxyQuizArena(req(path), path)).status).toBe(404);
    expect(backend).not.toHaveBeenCalled();
  });
  it.each(["auth/login", "auth/2fa/verify", "auth/refresh", "promo", "promo/3/revoke", "promo/3/reveal", "users/3/bonus", "users/3/block", "users/3/unblock", "users/3/reset_state", "contact-requests/3/status"])("protects mutation %s against cross-origin", async path => {
    expect((await proxyQuizArena(req(path, "POST", undefined, "https://evil.test"), path)).status).toBe(403);
    expect(backend).not.toHaveBeenCalled();
  });
  it("requires explicit configuration and never falls back to public API", async () => {
    vi.stubEnv("QUIZ_ARENA_ADMIN_URL", "");
    vi.stubEnv("API_INTERNAL_URL", "https://other.test");
    expect((await proxyQuizArena(req("users"), "users")).status).toBe(503);
    expect(backend).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500])("preserves denial and sanitizes errors (%s)", async status => {
    backend.mockResolvedValue(new Response("sensitive upstream diagnostics", { status }));
    const result = await proxyQuizArena(req("users"), "users");
    expect(result.status).toBe(status === 500 ? 502 : status);
    expect(await result.text()).not.toContain("sensitive");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it("isolates network failures", async () => {
    backend.mockRejectedValue(new Error("private details"));
    expect((await proxyQuizArena(req("system"), "system")).status).toBe(503);
  });
  it("seals backend cookies, binds them to the site session and forwards only backend auth cookies", async () => {
    backend.mockResolvedValueOnce(new Response('{"requires_2fa":true}', { headers: { "Set-Cookie": "qa_admin_access=synthetic; HttpOnly; Secure" } }));
    const login = await proxyQuizArena(req("auth/login", "POST"), "auth/login");
    const cookie = login.cookies.get("quiz_arena_session")!.value;
    expect(cookie).not.toContain("synthetic");
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("Path=/api/admin/quiz-arena");
    await proxyQuizArena(req("users", "GET", `site_admin_session=${siteToken}; quiz_arena_session=${cookie}; unrelated=private`), "users");
    const options = backend.mock.calls.at(-1)![1];
    expect(options.headers.get("cookie")).toBe("qa_admin_access=synthetic");
    expect(options.redirect).toBe("error");
    expect(options.cache).toBe("no-store");
    siteToken = createSiteAdminSession("owner@example.test", "synthetic-test-password")!;
    await proxyQuizArena(req("users", "GET", `site_admin_session=${siteToken}; quiz_arena_session=${cookie}`), "users");
    expect(backend.mock.calls.at(-1)![1].headers.get("cookie")).toBeNull();
  });
  it("routes reveal through protected POST and denies alternate GET forms", async () => {
    expect((await proxyQuizArena(req("promo/3?reveal=1"), "promo/3")).status).toBe(405);
    await proxyQuizArena(req("promo/3/reveal", "POST"), "promo/3/reveal");
    expect(backend.mock.calls.at(-1)![0]).toBe("https://quiz.example.test/api/admin/promo/3?reveal=true");
    expect(backend.mock.calls.at(-1)![1].method).toBe("GET");
  });
  it("allows only historical operation/method pairs", () => {
    expect(allowedQuizRoute("promo/2/toggle", "PATCH")).toBe(true);
    expect(allowedQuizRoute("users", "DELETE")).toBe(false);
    expect(allowedQuizRoute("auth/login", "GET")).toBe(false);
  });
});
