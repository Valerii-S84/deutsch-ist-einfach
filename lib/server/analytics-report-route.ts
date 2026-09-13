import "server-only";
import { NextRequest } from "next/server";
import { isAnalyticsReportDays, type AnalyticsReportDays } from "@/lib/analytics/report-contract";
import { AnalyticsServiceError } from "./analytics-service-client";
import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "./site-admin-auth";

export async function handleAnalyticsReport(request: NextRequest, read: (days: AnalyticsReportDays) => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!getSiteAdminSession(request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value)) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401, headers });
  const params = request.nextUrl.searchParams;
  const days = Number(params.get("days") ?? 7);
  if ([...params.keys()].some(key => key !== "days" || params.getAll(key).length !== 1) || !isAnalyticsReportDays(days)) return Response.json({ error: "invalid_report_query" }, { status: 400, headers });
  try { return Response.json(await read(days), { headers }); }
  catch (error) { return Response.json({ error: "analytics_unavailable" }, { status: error instanceof AnalyticsServiceError ? error.status : 503, headers }); }
}
