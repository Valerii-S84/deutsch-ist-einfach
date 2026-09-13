import { NextRequest } from "next/server";
import { parseReportSelection } from "@/lib/analytics/report-selection";

import { EVENT_NAMES, normalizeAnalyticsPath } from "@/lib/analytics/contract";
import { isAnalyticsReportDays, type AnalyticsReportDays, type AnalyticsSessions } from "@/lib/analytics/report-contract";
import { AnalyticsServiceError, readAnalyticsSessions } from "@/lib/server/analytics-service-client";
import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const allowedParams = new Set(["days", "page", "path", "event_name", "selection"]);

export async function GET(request: NextRequest) {
  if (!getSiteAdminSession(request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value)) {
    return Response.json({ error: "AUTH_REQUIRED" }, { status: 401, headers });
  }
  const params = request.nextUrl.searchParams;
  if ([...params.keys()].some(key => !allowedParams.has(key) || params.getAll(key).length > 1)) {
    return Response.json({ error: "invalid_report_query" }, { status: 400, headers });
  }
  const daysValue = params.get("days") ?? "7";
  const pageValue = params.get("page") ?? "1";
  const days = Number(daysValue);
  const page = Number(pageValue);
  const path = parsePath(params.get("path"));
  const eventName = parseEventName(params.get("event_name"));
  const selection = parseReportSelection(params.get("selection"));
  if (selection === false) return Response.json({ error: "invalid_report_query" }, { status: 400, headers });
  if (!Number.isSafeInteger(days) || !isAnalyticsReportDays(days) || !Number.isSafeInteger(page) || page < 1 || page > 100_000 || path === false || eventName === false) {
    return Response.json({ error: "invalid_report_query" }, { status: 400, headers });
  }
  try {
    return Response.json(await readAnalyticsSessions({
      days: days as AnalyticsReportDays,
      page,
      selection,
      path: path ?? undefined,
      eventName: eventName as AnalyticsSessions["filters"]["event_name"],
    }), { headers });
  } catch (error) {
    return Response.json({ error: "analytics_unavailable" }, { status: error instanceof AnalyticsServiceError ? error.status : 503, headers });
  }
}

function parsePath(value: string | null): string | null | false {
  if (value === null) return null;
  if (!value || value.length > 2048) return false;
  if (value === "unknown") return value;
  const normalized = normalizeAnalyticsPath(value);
  return normalized === "unknown" ? false : normalized;
}

function parseEventName(value: string | null): typeof EVENT_NAMES[number] | null | false {
  if (value === null) return null;
  return (EVENT_NAMES as readonly string[]).includes(value) ? value as typeof EVENT_NAMES[number] : false;
}
