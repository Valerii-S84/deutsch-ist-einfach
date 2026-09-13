import { NextRequest } from "next/server";
import { analyticsId } from "@/lib/analytics/contract";
import { AnalyticsServiceError, readAnalyticsSession } from "@/lib/server/analytics-service-client";
import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!getSiteAdminSession(request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value)) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401, headers });
  const id = analyticsId.safeParse((await params).sessionId);
  if (!id.success || new URL(request.url).search) return Response.json({ error: "invalid_session_request" }, { status: 400, headers });
  try { return Response.json(await readAnalyticsSession(id.data), { headers }); }
  catch (error) { return Response.json({ error: "analytics_unavailable" }, { status: error instanceof AnalyticsServiceError ? error.status : 503, headers }); }
}
