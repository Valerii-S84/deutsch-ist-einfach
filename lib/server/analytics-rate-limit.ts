import { createRequestRateLimiter } from "./request-rate-limit";

export function createAnalyticsRateLimiter() {
  return createRequestRateLimiter({ maxRequests: 60 });
}
