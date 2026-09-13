import { NextResponse } from "next/server";

import {
  createSiteAdminSession,
  isSameOriginAdminRequest,
  isSiteAdminConfigured,
  SITE_ADMIN_SESSION_COOKIE,
  siteAdminCookieOptions,
} from "@/lib/server/site-admin-auth";

export const runtime = "nodejs";
const RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };
const MAX_BODY_BYTES = 4096;

// One account, one bounded budget per server process; no spoofable IP headers.
let loginBudget = { attempts: 0, resetsAt: 0 };

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: RESPONSE_HEADERS });
  }
  if (!isSiteAdminConfigured()) {
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: RESPONSE_HEADERS });
  }

  const now = Date.now();
  if (now >= loginBudget.resetsAt) loginBudget = { attempts: 0, resetsAt: now + 60_000 };
  if (loginBudget.attempts >= 10) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, {
      status: 429,
      headers: { ...RESPONSE_HEADERS, "Retry-After": String(Math.ceil((loginBudget.resetsAt - now) / 1000)) },
    });
  }
  loginBudget.attempts += 1;

  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 415, headers: RESPONSE_HEADERS });
  }

  // Bound the actual stream, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: RESPONSE_HEADERS });
  }
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 413, headers: RESPONSE_HEADERS });
      }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || !("email" in body) || !("password" in body) ||
      typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: RESPONSE_HEADERS });
    }

    const token = createSiteAdminSession(body.email, body.password);
    if (!token) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401, headers: RESPONSE_HEADERS });
    }

    const response = NextResponse.json({ ok: true }, { headers: RESPONSE_HEADERS });
    response.cookies.set(SITE_ADMIN_SESSION_COOKIE, token, siteAdminCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: RESPONSE_HEADERS });
  } finally {
    reader.releaseLock();
  }
}
