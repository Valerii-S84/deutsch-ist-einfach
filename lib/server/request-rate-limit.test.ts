// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createRequestRateLimiter } from "./request-rate-limit";
vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
const request = (peer?: string) => new Request("https://example.test", { headers: peer ? { "X-Forwarded-For": peer } : {} });
it("isolates final trusted peers, ignores forged prefixes and expires limits", () => {
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  const limit = createRequestRateLimiter({ maxRequests: 2 });
  expect(limit(request("1.1.1.1, 192.0.2.1"), 1000)).toBe(0);
  expect(limit(request("2.2.2.2, 192.0.2.1"), 1000)).toBe(0);
  expect(limit(request("192.0.2.1"), 1000)).toBe(60);
  expect(limit(request("192.0.2.2"), 1000)).toBe(0);
  expect(limit(request("192.0.2.1"), 61000)).toBe(0);
});
it("fails closed for unknown production clients without allocating a shared owner budget", () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("ANALYTICS_TRUST_PROXY", "0");
  const limit = createRequestRateLimiter({ maxRequests: 1, requireTrustedClient: true });
  expect(limit(request("192.0.2.1"))).toBeNull();
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  expect(limit(request())).toBeNull();
  expect(limit(request("invalid"))).toBeNull();
  expect(limit(request("192.0.2.1"))).toBe(0);
});
it("normalizes equivalent IPv6 spellings into one budget", () => {
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  const limit = createRequestRateLimiter({ maxRequests: 1 });
  expect(limit(request("2001:db8::1"))).toBe(0);
  expect(limit(request("2001:0db8:0:0:0:0:0:1"))).toBeGreaterThan(0);
});
