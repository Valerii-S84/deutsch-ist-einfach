// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { syntheticEvent } from "@/lib/analytics/fixtures.test-support";
import { sendAnalyticsEvents, AnalyticsServiceError } from "@/lib/server/analytics-service-client";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-service-client", () => ({ sendAnalyticsEvents: vi.fn(), AnalyticsServiceError: class extends Error { constructor(public status = 503) { super(); } } }));
let source = 0;
function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://deutschmit.example.test/api/public/analytics/events", { method: "POST", headers: { Origin: "https://deutschmit.example.test", "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${++source}`, ...headers }, body: JSON.stringify(payload) });
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://deutschmit.example.test");
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  vi.mocked(sendAnalyticsEvents).mockResolvedValue({ accepted: 1, inserted: 1, duplicates: 0 });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("sets the product server-side and waits for persistence acknowledgement", async () => {
  const event = syntheticEvent(); delete event.product_id;
  const response = await POST(request({ events: [event] }));
  expect(response.status).toBe(200);
  expect(sendAnalyticsEvents).toHaveBeenCalledWith([expect.objectContaining({ product_id: "deutschmit" })], "browser");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
const rejectedOrigins: Record<string, string>[] = [{ Origin: "https://foreign.example.test" }, { Origin: "null" }, { Origin: "" }, { "Sec-Fetch-Site": "cross-site" }];
it.each(rejectedOrigins)("rejects bad origins before forwarding %j", async headers => {
  expect((await POST(request({ events: [syntheticEvent()] }, headers))).status).toBe(403);
  expect(sendAnalyticsEvents).not.toHaveBeenCalled();
});
it.each([{ ...syntheticEvent(), product_id: "quiz-arena" }, syntheticEvent("form_success"), { ...syntheticEvent(), source: "server" }, { ...syntheticEvent(), metadata: { extra: "private" } }])("rejects unauthorized event payload", async event => {
  expect((await POST(request({ events: [event] }))).status).toBe(400);
  expect(sendAnalyticsEvents).not.toHaveBeenCalled();
});
it("fails when persistence fails and rejects excessive body before forwarding", async () => {
  vi.mocked(sendAnalyticsEvents).mockRejectedValue(new AnalyticsServiceError());
  expect((await POST(request({ events: [syntheticEvent()] }))).status).toBe(503);
  vi.mocked(sendAnalyticsEvents).mockClear();
  expect((await POST(request("x".repeat(33_000)))).status).toBe(413);
  expect(sendAnalyticsEvents).not.toHaveBeenCalled();
});
