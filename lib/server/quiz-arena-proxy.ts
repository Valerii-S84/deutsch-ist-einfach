import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { parseQuizJson } from "../quiz-arena-json";
import { NextRequest, NextResponse } from "next/server";
import { getSiteAdminSession, isSameOriginAdminRequest, SITE_ADMIN_SESSION_COOKIE } from "./site-admin-auth";

const COOKIE = "quiz_arena_session";
const COOKIE_PATH = "/api/admin/quiz-arena";
const MAX_AGE = 8 * 60 * 60;
const HEADERS = { "Cache-Control": "private, no-store" };
type CookieJar = Record<string, string>;

// Bind backend credentials to this exact, independently validated site session.
function key(siteToken: string) {
  return createHash("sha256").update(process.env.SITE_ADMIN_SESSION_SECRET!).update(siteToken).digest();
}

function seal(jar: CookieJar, siteToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(siteToken), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ jar, expires: Date.now() + MAX_AGE * 1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function unseal(value: string | undefined, siteToken: string): CookieJar {
  if (!value || value.length > 6000) return {};
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(siteToken), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
    if (payload.expires <= Date.now()) return {};
    return payload.jar;
  } catch { return {}; }
}

export function allowedQuizRoute(path: string, method: string): boolean {
  if (method === "GET") return /^(contact-requests|overview|users|users\/[1-9]\d*|content|system|economy\/(purchases|subscriptions|cohorts)|promo|promo\/(products|check-code)|promo\/[1-9]\d*(\/(stats|audit))?|auth\/session)$/.test(path);
  if (method === "POST") return /^(auth\/(login|2fa\/verify|logout|refresh)|contact-requests\/[1-9]\d*\/status|users\/[1-9]\d*\/(bonus|block|unblock|reset_state)|promo|promo\/bulk-generate|promo\/[1-9]\d*\/(revoke|reveal))$/.test(path);
  if (method === "PATCH") return /^promo\/[1-9]\d*(\/toggle)?$/.test(path);
  return false;
}

export async function proxyQuizArena(request: NextRequest, path: string) {
  const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: HEADERS });
  const siteToken = request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value;
  if (!getSiteAdminSession(siteToken)) return fail(401, "SITE_AUTH_REQUIRED");
  if (!allowedQuizRoute(path, request.method)) return fail(404, "UNKNOWN_QUIZ_ROUTE");
  // Expose the historical audited GET only through a CSRF-protected POST.
  if (request.method === "GET" && request.nextUrl.searchParams.has("reveal")) return fail(405, "USE_REVEAL_POST");
  if (request.method !== "GET" && !isSameOriginAdminRequest(request)) {
    return fail(403, "CSRF_VALIDATION_FAILED");
  }
  const configured = process.env.QUIZ_ARENA_ADMIN_URL?.trim();
  if (!configured) return fail(503, "QUIZ_ARENA_NOT_CONFIGURED");
  let base: URL;
  try {
    base = new URL(configured);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error();
    if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new Error();
  } catch { return fail(503, "QUIZ_ARENA_CONFIG_INVALID"); }

  const jar = path === "auth/login" ? {} : unseal(request.cookies.get(COOKIE)?.value, siteToken!);
  const headers = new Headers({ Accept: "application/json", "X-Requested-With": "XMLHttpRequest" });
  if (Object.keys(jar).length) headers.set("Cookie", Object.entries(jar).map(([name, value]) => `${name}=${value}`).join("; "));
  // Preserve browser origin for backend's own trusted-origin and RBAC checks.
  if (request.headers.get("origin")) headers.set("Origin", request.headers.get("origin")!);
  let body: string | undefined;
  if (request.method !== "GET") {
    body = await request.text();
    if (Buffer.byteLength(body) > 64 * 1024) return fail(413, "BODY_TOO_LARGE");
    if (body) {
      try { JSON.parse(body); } catch { return fail(400, "INVALID_JSON"); }
      headers.set("Content-Type", "application/json");
    }
  }
  try {
    const reveal = path.endsWith("/reveal");
    const upstreamPath = reveal ? `${path.slice(0, -7)}?reveal=true` : `${path}${request.nextUrl.search}`;
    const upstream = await fetch(`${base.toString().replace(/\/$/, "")}/admin/${upstreamPath}`, {
      method: reveal ? "GET" : request.method, headers, body: reveal ? undefined : body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    // Never expose upstream error bodies, cookies, redirect locations or headers.
    if (!upstream.ok) return fail([400, 401, 403, 404, 409, 422, 429].includes(upstream.status) ? upstream.status : 502,
      upstream.status === 401 ? "QUIZ_AUTH_REQUIRED" : upstream.status === 403 ? "QUIZ_AUTH_FORBIDDEN" : "QUIZ_REQUEST_FAILED");
    const data: unknown = upstream.status === 204 ? null : parseQuizJson(await upstream.text());
    for (const cookie of upstream.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!["qa_admin_access", "qa_admin_refresh"].includes(name) || /[\r\n;]/.test(value)) continue;
      if (!value || /max-age=0(?:;|$)/i.test(cookie)) delete jar[name];
      else jar[name] = value;
    }
    const response = NextResponse.json(data, { headers: HEADERS });
    const token = path === "auth/logout" ? "" : seal(jar, siteToken!);
    if (token.length > 3800) return fail(502, "QUIZ_SESSION_TOO_LARGE");
    if (upstream.headers.getSetCookie().length || path === "auth/logout" || path === "auth/login") response.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: COOKIE_PATH, maxAge: token ? MAX_AGE : 0 });
    return response;
  } catch { return fail(503, "QUIZ_ARENA_UNAVAILABLE"); }
}
