import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

export function createAnalyticsRateLimiter() {
  const salt = randomBytes(32);
  const buckets = new Map<string, { count: number; expires: number }>();
  return (request: Request, now = Date.now()) => {
    // Only enable behind a trusted final proxy which appends/sets the real peer.
    // Without that deployment boundary all requests share a fail-closed bucket.
    const forwarded = process.env.ANALYTICS_TRUST_PROXY === "1" ? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() : undefined;
    const address = forwarded && isIP(forwarded) ? forwarded : "shared-untrusted-source";
    const key = createHmac("sha256", salt).update(address).digest("hex");
    for (const [id, bucket] of buckets) if (bucket.expires <= now) buckets.delete(id);
    const bucket = buckets.get(key) ?? { count: 0, expires: now + 60_000 };
    if ((!buckets.has(key) && buckets.size >= 10_000) || bucket.count >= 60) return Math.max(1, Math.ceil((bucket.expires - now) / 1000));
    bucket.count++;
    buckets.set(key, bucket);
    return 0;
  };
}
