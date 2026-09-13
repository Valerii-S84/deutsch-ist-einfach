import { NextResponse } from "next/server";
import { createRequestRateLimiter } from "@/lib/server/request-rate-limit";

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

const limit = createRequestRateLimiter({ maxRequests: 10, requireTrustedClient: true });

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: RESPONSE_HEADERS });
  }
  if (!isSiteAdminConfigured()) {
    return NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: RESPONSE_HEADERS });
  }

  const retryAfter = limit(request);
  if (retryAfter === null) {
    return NextResponse.json({ error: "AUTH_CLIENT_UNAVAILABLE" }, { status: 503, headers: RESPONSE_HEADERS });
  }
  if (retryAfter > 0) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, {
      status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": String(retryAfter) },
    });
  }

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
