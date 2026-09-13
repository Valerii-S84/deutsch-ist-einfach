import { NextResponse } from "next/server";
import { AnalyticsHttpError, readAnalyticsJson } from "@/lib/analytics/http";
import { createAnalyticsRateLimiter } from "@/lib/server/analytics-rate-limit";
import { getSiteUrl } from "@/lib/public-site-config";

const limit = createAnalyticsRateLimiter();

import { siteAnalyticsEventPayloadSchema } from "@/lib/site-analytics-contract";
import { saveSiteAnalyticsEvent } from "@/lib/server/site-analytics-store";

export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: RESPONSE_HEADERS,
    },
  );
}

export async function POST(request: Request) {
  let expectedOrigin: string;
  try { expectedOrigin = new URL(getSiteUrl()).origin; }
  catch { return errorResponse("analytics_unavailable", 503); }
  if (request.headers.get("origin") !== expectedOrigin ||
      (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return errorResponse("origin_rejected", 403);
  }
  const retryAfter = limit(request);
  if (retryAfter) return NextResponse.json({ error: "rate_limited" }, {
    status: 429, headers: { ...RESPONSE_HEADERS, "Retry-After": String(retryAfter) },
  });
  let untrustedPayload: unknown;
  try {
    untrustedPayload = await readAnalyticsJson(request);
  } catch (error) {
    return errorResponse(error instanceof AnalyticsHttpError ? error.code : "invalid_json",
      error instanceof AnalyticsHttpError ? error.status : 400);
  }

  const validation = siteAnalyticsEventPayloadSchema.safeParse(untrustedPayload);
  if (!validation.success) {
    return errorResponse("invalid_payload", 422);
  }

  try {
    await saveSiteAnalyticsEvent(validation.data);
  } catch {
    return errorResponse("analytics_persistence_failed", 500);
  }

  return new Response(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}
