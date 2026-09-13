// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSiteAdminSession,
  getSiteAdminSession,
  isSiteAdminConfigured,
  SITE_ADMIN_SESSION_MAX_AGE,
} from "./site-admin-auth";

vi.mock("server-only", () => ({}));

const email = "admin@example.com";
const password = "site-test-password";
const secret = "test-signing-key-with-at-least-32-bytes";

beforeEach(() => {
  vi.stubEnv("SITE_ADMIN_EMAIL", email);
  vi.stubEnv("SITE_ADMIN_PASSWORD", password);
  vi.stubEnv("SITE_ADMIN_SESSION_SECRET", secret);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("site-owned signed session", () => {
  it("creates a unique valid session without credentials in the payload", () => {
    const token = createSiteAdminSession(email, password)!;
    expect(getSiteAdminSession(token)).toEqual({ email });
    expect(createSiteAdminSession(email, password)).not.toBe(token);
    const payload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
    for (const value of [email, password, secret]) expect(payload).not.toContain(value);
  });

  it.each([[email, "wrong-password"], ["other@example.com", password], [email, ""]])(
    "rejects incorrect credentials", (inputEmail, inputPassword) => {
      expect(createSiteAdminSession(inputEmail, inputPassword)).toBeNull();
    },
  );

  it("rejects tampered payloads, signatures, extra segments and malformed tokens", () => {
    const token = createSiteAdminSession(email, password)!;
    const [payload, signature] = token.split(".");
    for (const invalid of [undefined, "", "invalid", `${payload}x.${signature}`, `${payload}.${"A".repeat(43)}`, `${token}.extra`, "x".repeat(2049)]) {
      expect(getSiteAdminSession(invalid)).toBeNull();
    }
  });

  it("rejects a session at its expiry and before its issue time", () => {
    const token = createSiteAdminSession(email, password)!;
    vi.advanceTimersByTime((SITE_ADMIN_SESSION_MAX_AGE - 1) * 1000);
    expect(getSiteAdminSession(token)).toEqual({ email });
    vi.advanceTimersByTime(1000);
    expect(getSiteAdminSession(token)).toBeNull();
    vi.setSystemTime(new Date("2026-09-07T11:59:59Z"));
    expect(getSiteAdminSession(token)).toBeNull();
  });

  it.each(["SITE_ADMIN_EMAIL", "SITE_ADMIN_PASSWORD", "SITE_ADMIN_SESSION_SECRET"])(
    "fails closed without %s and invalidates sessions on rotation", (name) => {
      const token = createSiteAdminSession(email, password)!;
      vi.stubEnv(name, "");
      expect(isSiteAdminConfigured()).toBe(false);
      expect(createSiteAdminSession(email, password)).toBeNull();
      expect(getSiteAdminSession(token)).toBeNull();
      vi.stubEnv(name, "rotated-value-with-at-least-32-bytes@example.com");
      expect(getSiteAdminSession(token)).toBeNull();
    },
  );

  it.each([["SITE_ADMIN_PASSWORD", "short"], ["SITE_ADMIN_SESSION_SECRET", "short"]])(
    "fails closed with a weak %s", (name, value) => {
      vi.stubEnv(name, value);
      expect(isSiteAdminConfigured()).toBe(false);
      expect(createSiteAdminSession(email, password)).toBeNull();
    },
  );

  it.each(["null", "not-json", '{"version":2}', '{"version":1,"issuedAt":0,"expiresAt":9999999999}'])(
    "rejects malformed signed claims", (json) => {
      const payload = Buffer.from(json).toString("base64url");
      const key = createHmac("sha256", secret).update(JSON.stringify([email, password])).digest();
      const signature = createHmac("sha256", key).update(payload).digest("base64url");
      expect(getSiteAdminSession(`${payload}.${signature}`)).toBeNull();
    },
  );
});
