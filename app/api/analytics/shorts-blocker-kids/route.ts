import { createHash } from "node:crypto";
import { shortsBatchSchema } from "@/lib/analytics/shorts-contract";
import { AnalyticsHttpError, readAnalyticsJson } from "@/lib/analytics/http";
import { requestShortsService } from "@/lib/server/shorts-statistics";

export const runtime = "nodejs";
const origins = new Set(["https://www.shortsblockerkids.de", "https://shortsblockerkids.de"]);
const buckets = new Map<string, { at: number; count: number }>();
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!origins.has(request.headers.get("origin") ?? "") || new URL(request.url).search) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const now = Date.now();
  for (const [key, value] of buckets) if (now - value.at >= 60_000) buckets.delete(key);
  const address = process.env.ANALYTICS_TRUST_PROXY === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : "unknown";
  const key = createHash("sha256").update(address).digest("hex");
  const bucket = buckets.get(key) ?? { at: now, count: 0 };
  if (bucket.count >= 120 || (buckets.size >= 10_000 && !buckets.has(key))) return Response.json({ error: "rate_limited" }, { status: 429, headers });
  bucket.count += 1; buckets.set(key, bucket);
  try {
    const parsed = shortsBatchSchema.safeParse(await readAnalyticsJson(request));
    if (!parsed.success) return Response.json({ error: "invalid_payload" }, { status: 400, headers });
    await requestShortsService(parsed.data);
    return Response.json({ accepted: parsed.data.events.length }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof AnalyticsHttpError ? error.code : "analytics_unavailable" }, { status: error instanceof AnalyticsHttpError ? error.status : 503, headers });
  }
}
