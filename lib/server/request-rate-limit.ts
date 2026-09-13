import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

export function createRequestRateLimiter({ maxRequests, windowMs = 60_000, requireTrustedClient = false }: {
  maxRequests: number; windowMs?: number; requireTrustedClient?: boolean;
}) {
  const salt = randomBytes(32);
  const buckets = new Map<string, { count: number; expires: number }>();
  return (request: Request, now = Date.now()): number | null => {
    // Caddy must overwrite this header and be the only public entrypoint.
    const forwarded = process.env.ANALYTICS_TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() : undefined;
    const valid = forwarded && isIP(forwarded) ? forwarded : undefined;
    // An unknown production peer must not share the owner's login budget.
    if (requireTrustedClient && process.env.NODE_ENV === "production" && !valid) return null;
    const address = valid && isIP(valid) === 6 ? new URL("http://[" + valid + "]").hostname : valid;
    const key = createHmac("sha256", salt).update(address ?? "shared-untrusted-source").digest("hex");
    for (const [id, bucket] of buckets) if (bucket.expires <= now) buckets.delete(id);
    const bucket = buckets.get(key) ?? { count: 0, expires: now + windowMs };
    if ((!buckets.has(key) && buckets.size >= 10_000) || bucket.count >= maxRequests) {
      return Math.max(1, Math.ceil((bucket.expires - now) / 1000));
    }
    bucket.count++;
    buckets.set(key, bucket);
    return 0;
  };
}
