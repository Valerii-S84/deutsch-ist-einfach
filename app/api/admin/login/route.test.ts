// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { readSiteAnalyticsOverview } from "@/lib/server/site-analytics-store";
import { POST as login } from "./route";
import { POST as logout } from "../logout/route";
import { GET as analytics } from "../website-analytics/overview/route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/site-analytics-store", () => ({ readSiteAnalyticsOverview: vi.fn() }));

const origin = "https://site.example";
const credentials = { email: "admin@example.com", password: "site-test-password" };
let clock = Date.parse("2026-09-07T12:00:00Z");

function request(path = "login", body = JSON.stringify(credentials), headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/admin/${path}`, {
    method: "POST", body,
    headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": "192.0.2.1", ...headers },
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  vi.stubEnv("SITE_ADMIN_EMAIL", credentials.email);
  vi.stubEnv("SITE_ADMIN_PASSWORD", credentials.password);
  vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "test-signing-key-with-at-least-32-bytes");
  vi.stubEnv("API_INTERNAL_URL", "");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  vi.stubEnv("QUIZ_BANK_API_BASE_URL", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No backend allowed"); }));
  vi.useFakeTimers();
  clock += 120_000;
  vi.setSystemTime(clock);
  vi.mocked(readSiteAnalyticsOverview).mockResolvedValue({ days: 7 } as never);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("local admin login/logout boundary with Quiz Arena OFF", () => {
  it("creates a production cookie, authorizes Analytics, and removes access on logout", async () => {
    const response = await login(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.cookies.get(SITE_ADMIN_SESSION_COOKIE)!;
    expect(getSiteAdminSession(cookie.value)).toEqual({ email: credentials.email });
    const cookieHeader = response.headers.get("set-cookie")!;
    expect(cookieHeader).toMatch(/HttpOnly/i);
    expect(cookieHeader).toMatch(/Secure/i);
    expect(cookieHeader).toMatch(/SameSite=strict/i);
    expect(cookieHeader).toMatch(/Max-Age=28800/i);
    expect(cookieHeader).not.toMatch(/Domain=/i);
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    const privateRequest = (value: string) => new NextRequest(`${origin}/api/admin/website-analytics/overview`, {
      headers: { cookie: `${SITE_ADMIN_SESSION_COOKIE}=${value}` },
    });
    expect((await analytics(privateRequest(cookie.value))).status).toBe(200);
    expect(readSiteAnalyticsOverview).toHaveBeenCalledExactlyOnceWith(7);

    const loggedOut = await logout(request("logout", "", { cookie: `${cookie.name}=${cookie.value}` }));
    expect(loggedOut.status).toBe(303);
    expect(loggedOut.headers.get("location")).toBe("/admin/login");
    expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(loggedOut.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.path).toBe("/");
    expect((await analytics(privateRequest(loggedOut.cookies.get(SITE_ADMIN_SESSION_COOKIE)!.value))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["wrong-password", ""])("never sets a session for an incorrect password", async (password) => {
    const response = await login(request("login", JSON.stringify({ ...credentials, password })));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not disclose whether an account exists", async () => {
    const wrongEmail = await login(request("login", JSON.stringify({ ...credentials, email: "other@example.com" })));
    const wrongPassword = await login(request("login", JSON.stringify({ ...credentials, password: "wrong" })));
    expect(wrongEmail.status).toBe(wrongPassword.status);
    expect(await wrongEmail.json()).toEqual(await wrongPassword.json());
  });

  it.each(["", "null", "https://evil.example", "https://sub.site.example", "http://site.example"])(
    "rejects login and logout from an untrusted or absent Origin (%s)", async (originHeader) => {
      for (const handler of [login, logout]) {
        const response = await handler(request("login", "", { Origin: originHeader }));
        expect(response.status).toBe(403);
        expect(response.headers.get("set-cookie")).toBeNull();
      }
    },
  );

  it("ignores a forged forwarded host and rejects cross-site fetch metadata", async () => {
    expect((await login(request("login", "", { Origin: "https://evil.example", "x-forwarded-host": "evil.example" }))).status).toBe(403);
    expect((await login(request("login", "", { "Sec-Fetch-Site": "cross-site" }))).status).toBe(403);
  });

  it("supports a preserved site Host behind an internal HTTP proxy", async () => {
    const response = await login(new Request("http://localhost:3000/api/admin/login", {
      method: "POST", body: JSON.stringify(credentials),
      headers: { Origin: origin, Host: "site.example", "Content-Type": "application/json", "X-Forwarded-For": "192.0.2.1" },
    }));
    expect(response.status).toBe(200);
  });

  it("allows local HTTP development with a non-Secure HttpOnly cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await login(new Request("http://localhost:3000/api/admin/login", {
      method: "POST", body: JSON.stringify(credentials),
      headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("fails closed when credentials are not configured", async () => {
    vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "");
    const response = await login(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(["not-json", "null", "{}", '{"email":123,"password":true}'])("rejects invalid request bodies", async (body) => {
    const response = await login(request("login", body));
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects oversized bodies and form content types", async () => {
    expect((await login(request("login", "x".repeat(4097)))).status).toBe(413);
    expect((await login(request("login", "", { "Content-Type": "text/plain" }))).status).toBe(415);
  });

  it("limits an attacking peer without locking out the owner on another peer", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await login(request("login", "{}", { "x-forwarded-for": "192.0.2." + i + ", 198.51.100.20" }))).status).toBe(400);
    }
    const blocked = await login(request("login", JSON.stringify(credentials), { "x-forwarded-for": "198.51.100.20" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect((await login(request())).status).toBe(200);
    vi.advanceTimersByTime(60_000);
    expect((await login(request("login", JSON.stringify(credentials), { "x-forwarded-for": "198.51.100.20" }))).status).toBe(200);
  });
  it("requires a configured trusted peer in production instead of sharing an owner budget", async () => {
    vi.stubEnv("ANALYTICS_TRUST_PROXY", "0");
    expect((await login(request())).status).toBe(503);
    vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
    expect((await login(request("login", JSON.stringify(credentials), { "x-forwarded-for": "invalid" }))).status).toBe(503);
    expect((await login(request())).status).toBe(200);
  });
});
