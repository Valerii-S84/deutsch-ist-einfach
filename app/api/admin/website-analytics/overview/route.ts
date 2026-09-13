import { NextRequest, NextResponse } from "next/server";

import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { readSiteAnalyticsOverview } from "@/lib/server/site-analytics-store";

export const runtime = "nodejs";

const RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const session = getSiteAdminSession(request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401, headers: RESPONSE_HEADERS });
  }

  const days = Number(new URL(request.url).searchParams.get("days") ?? "7");
  if (![7, 30, 90].includes(days)) {
    return NextResponse.json({ error: "invalid_days" }, { status: 400, headers: RESPONSE_HEADERS });
  }

  try {
    return NextResponse.json(await readSiteAnalyticsOverview(days), { headers: RESPONSE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "analytics_unavailable" },
      { status: 503, headers: RESPONSE_HEADERS },
    );
  }
}
