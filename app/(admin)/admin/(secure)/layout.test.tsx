// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSiteAdminSession } from "@/lib/server/site-admin-auth";
import SecureAdminLayout from "./layout";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));

function setCookie(value?: string) {
  vi.mocked(cookies).mockResolvedValue({ get: () => value ? { value } : undefined } as never);
}

beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", "admin@example.com");
  vi.stubEnv("SITE_ADMIN_PASSWORD", "site-test-password");
  vi.stubEnv("SITE_ADMIN_SESSION_SECRET", "test-signing-key-with-at-least-32-bytes");
  vi.stubEnv("API_INTERNAL_URL", "");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No backend allowed"); }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("analytics page protection", () => {
  it.each([undefined, "forged-cookie"])("redirects without a valid local session (%s)", async (token) => {
    setCookie(token);
    await expect(SecureAdminLayout({ children: "private analytics" })).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/admin/login");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders an authenticated administrator and local logout with Quiz Arena OFF", async () => {
    setCookie(createSiteAdminSession("admin@example.com", "site-test-password")!);
    const html = renderToStaticMarkup(await SecureAdminLayout({ children: "private analytics" }));
    expect(html).toContain("private analytics");
    expect(html).toContain("admin@example.com");
    expect(html).toContain('action="/api/admin/logout"');
    expect(redirect).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
