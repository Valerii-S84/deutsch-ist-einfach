import { NextResponse } from "next/server";

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
  let untrustedPayload: unknown;
  try {
    untrustedPayload = (await request.json()) as unknown;
  } catch {
    return errorResponse("invalid_json", 400);
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
