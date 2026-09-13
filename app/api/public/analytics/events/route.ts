import { parseAnalyticsBatch } from "@/lib/analytics/contract";
import { AnalyticsHttpError, readAnalyticsJson } from "@/lib/analytics/http";
import { AnalyticsServiceError, sendAnalyticsEvents } from "@/lib/server/analytics-service-client";
import { createAnalyticsRateLimiter } from "@/lib/server/analytics-rate-limit";
import { getSiteUrl } from "@/lib/public-site-config";

export const runtime = "nodejs";
const limit = createAnalyticsRateLimiter();
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  let expectedOrigin: string;
  try { expectedOrigin = new URL(getSiteUrl()).origin; }
  catch { return Response.json({ error: "analytics_unavailable" }, { status: 503, headers }); }
  if (origin !== expectedOrigin || (fetchSite && fetchSite !== "same-origin")) return Response.json({ error: "origin_rejected" }, { status: 403, headers });
  const retryAfter = limit(request);
  if (retryAfter) return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } });
  try {
    const payload = await readAnalyticsJson(request);
    let events;
    try { events = parseAnalyticsBatch(payload, "browser"); }
    catch { return Response.json({ error: "invalid_payload" }, { status: 400, headers }); }
    // The shared schema rejects foreign products; the gateway owns the namespace.
    const result = await sendAnalyticsEvents(events.map(event => ({ ...event, product_id: "deutschmit" })), "browser");
    return Response.json(result, { headers });
  } catch (error) {
    const status = error instanceof AnalyticsHttpError || error instanceof AnalyticsServiceError ? error.status : 503;
    return Response.json({ error: error instanceof AnalyticsHttpError ? error.code : "analytics_unavailable" }, { status, headers });
  }
}
