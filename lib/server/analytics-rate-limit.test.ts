// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createAnalyticsRateLimiter } from "./analytics-rate-limit";
vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
const request = (ip: string) => new Request("http://localhost", { headers: { "X-Forwarded-For": ip } });
it("allows exactly 60 per source, resets after 60s and uses the final proxy peer", () => {
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  const limit = createAnalyticsRateLimiter();
  for (let i = 0; i < 60; i++) expect(limit(request(`1.2.3.${i}, 192.0.2.1`), 1000)).toBe(0);
  expect(limit(request("192.0.2.1"), 1000)).toBe(60);
  expect(limit(request("192.0.2.2"), 1000)).toBe(0);
  expect(limit(request("192.0.2.1"), 61_000)).toBe(0);
});
it("cannot rotate attacker-supplied headers without a trusted proxy", () => {
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "0");
  const limit = createAnalyticsRateLimiter();
  for (let i = 0; i < 60; i++) expect(limit(request(`192.0.2.${i}`), 1000)).toBe(0);
  expect(limit(request("192.0.2.200"), 1000)).toBe(60);
});
