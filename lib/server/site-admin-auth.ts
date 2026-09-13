import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SITE_ADMIN_SESSION_COOKIE = "site_admin_session";
export const SITE_ADMIN_SESSION_MAX_AGE = 8 * 60 * 60;

function readConfig() {
  const email = process.env.SITE_ADMIN_EMAIL?.trim();
  const password = process.env.SITE_ADMIN_PASSWORD;
  const secret = process.env.SITE_ADMIN_SESSION_SECRET;
  if (!email || !password || password.length < 12 || !secret || Buffer.byteLength(secret) < 32) {
    return null;
  }

  // Changing any credential also invalidates previously issued sessions.
  const key = createHmac("sha256", secret).update(JSON.stringify([email, password])).digest();
  return { email, password, key };
}

export function isSiteAdminConfigured(): boolean {
  return readConfig() !== null;
}

function equalCredentials(actual: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export function createSiteAdminSession(email: string, password: string): string | null {
  const config = readConfig();
  if (!config) return null;

  const emailMatches = equalCredentials(email, config.email);
  const passwordMatches = equalCredentials(password, config.password);
  if (!emailMatches || !passwordMatches) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    issuedAt,
    expiresAt: issuedAt + SITE_ADMIN_SESSION_MAX_AGE,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");
  const signature = createHmac("sha256", config.key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function getSiteAdminSession(token: string | undefined): { email: string } | null {
  const config = readConfig();
  if (!config || !token || token.length > 2048) return null;

  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) {
    return null;
  }

  const [payload, signature] = parts;
  const expected = createHmac("sha256", config.key).update(payload).digest("base64url");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (
      !session || session.version !== 1 ||
      !Number.isSafeInteger(session.issuedAt) || !Number.isSafeInteger(session.expiresAt) ||
      session.issuedAt > now || session.expiresAt <= now ||
      session.expiresAt - session.issuedAt !== SITE_ADMIN_SESSION_MAX_AGE ||
      typeof session.nonce !== "string" || !/^[a-f0-9]{32}$/.test(session.nonce)
    ) return null;

    return { email: config.email };
  } catch {
    return null;
  }
}

export function siteAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SITE_ADMIN_SESSION_MAX_AGE,
  };
}

// Host is the site's request host; never accept client-supplied forwarded hosts.
// Origin is required even on login to prevent login CSRF.
export function isSameOriginAdminRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host") ?? requestUrl.host;
    const protocol = process.env.NODE_ENV === "production" ? "https:" : requestUrl.protocol;
    return origin === originUrl.origin && originUrl.host === host && originUrl.protocol === protocol;
  } catch {
    return false;
  }
}
