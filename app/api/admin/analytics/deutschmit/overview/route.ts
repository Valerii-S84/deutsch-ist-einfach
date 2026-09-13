import { NextRequest } from "next/server";

import { isAnalyticsReportDays, type AnalyticsReportDays } from "@/lib/analytics/report-contract";
import { AnalyticsServiceError, readAnalyticsOverview } from "@/lib/server/analytics-service-client";
import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  if (!getSiteAdminSession(request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value)) {
    return Response.json({ error: "AUTH_REQUIRED" }, { status: 401, headers });
  }
  const params = request.nextUrl.searchParams;
  const daysValue = params.get("days") ?? "7";
  const days = Number(daysValue);
  if (params.getAll("days").length > 1 || [...params.keys()].some(key => key !== "days") || !Number.isSafeInteger(days) || !isAnalyticsReportDays(days)) {
    return Response.json({ error: "invalid_report_query" }, { status: 400, headers });
  }
  try {
    return Response.json(await readAnalyticsOverview(days as AnalyticsReportDays), { headers });
  } catch (error) {
    return Response.json({ error: "analytics_unavailable" }, { status: error instanceof AnalyticsServiceError ? error.status : 503, headers });
  }
}
