import { NextResponse } from "next/server";
import { createRequestRateLimiter } from "@/lib/server/request-rate-limit";

const limit = createRequestRateLimiter({ maxRequests: 5, requireTrustedClient: true });

import { parseContactTransport } from "@/lib/contact/contact-schema";
import { handleContactSubmission } from "@/lib/server/contact-submission";

export const runtime = "nodejs";

const CONTACT_REQUEST_MAX_BYTES = 32 * 1024;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

class PayloadTooLargeError extends Error {}

function jsonResponse(body: Record<string, boolean | string>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function successResponse() {
  return jsonResponse({ ok: true }, 202);
}

function isSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  const hostHeader = request.headers.get("host") ?? new URL(request.url).host;

  if (!originHeader || !hostHeader) {
    return false;
  }

  try {
    const requestUrl = new URL(request.url);
    const origin = new URL(originHeader);
    const expectedOrigin = new URL(`${requestUrl.protocol}//${hostHeader}`);

    return originHeader === origin.origin && origin.origin === expectedOrigin.origin;
  } catch {
    return false;
  }
}

function hasOversizedContentLength(request: Request): boolean {
  const value = request.headers.get("content-length")?.trim();
  if (!value || !/^\d+$/.test(value)) {
    return false;
  }

  return Number(value) > CONTACT_REQUEST_MAX_BYTES;
}

async function readBodyWithLimit(request: Request): Promise<string> {
  if (hasOversizedContentLength(request)) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      byteLength += value.byteLength;
      if (byteLength > CONTACT_REQUEST_MAX_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const retryAfter = limit(request);
  if (retryAfter === null) return jsonResponse({ error: "contact_unavailable" }, 503);
  if (retryAfter > 0) return NextResponse.json({ error: "rate_limited" }, {
    status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": String(retryAfter) },
  });
  let rawBody: string;
  try {
    rawBody = await readBodyWithLimit(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }

    return jsonResponse({ error: "invalid_json" }, 400);
  }

  let untrustedPayload: unknown;
  try {
    untrustedPayload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const { validation, analytics } = parseContactTransport(untrustedPayload);
  if (!validation.success) {
    return jsonResponse({ error: "invalid_payload" }, 422);
  }

  const payload = validation.data;
  if (payload.company.trim()) {
    return successResponse();
  }

  try {
    if (analytics) await handleContactSubmission(payload, analytics);
    else await handleContactSubmission(payload);
  } catch {
    return jsonResponse({ error: "contact_submission_failed" }, 500);
  }

  return successResponse();
}
