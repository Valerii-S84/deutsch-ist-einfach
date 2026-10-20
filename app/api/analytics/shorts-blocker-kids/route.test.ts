// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/server/shorts-statistics", () => ({ requestShortsService: vi.fn() }));
import { requestShortsService } from "@/lib/server/shorts-statistics";
import { POST } from "./route";
const payload = { events: [{
  event_id: "d8b19e89-bb5e-4a0b-a4b4-f6a3c01d68d7", visitor_id: "0af1b51e-7e9c-4e27-87a7-c5b192afdd89",
  session_id: "0dbb2687-6c58-4f12-9d2e-52497c1ba9bd", page_view_id: "1c0a42ad-7e6b-49e9-8d37-5fe24cc07e69",
  event_name: "page_view", occurred_at: new Date().toISOString(), sequence: 1, path: "/",
  element_id: null, active_ms: null, referrer_host: null, device: "desktop", is_test: false,
}] };
const request = (
  body: unknown,
  origin = "https://www.shortsblockerkids.de",
  init: RequestInit = {},
) => new Request(init.url ?? "https://deutschmit.de/api/analytics/shorts-blocker-kids", {
  method: "POST",
  ...init,
  headers: { Origin: origin, "Content-Type": "application/json", ...init.headers },
  body: init.body ?? JSON.stringify(body),
});
beforeEach(() => { vi.mocked(requestShortsService).mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });
it("rejects an unrelated origin before touching the collector", async () => {
  expect((await POST(request(payload, "https://example.org"))).status).toBe(403);
  expect(requestShortsService).not.toHaveBeenCalled();
});
it("rejects allowed origins when the collector endpoint is called with a query string", async () => {
  expect((await POST(request(payload, "https://shortsblockerkids.de", {
    url: "https://deutschmit.de/api/analytics/shorts-blocker-kids?debug=1",
  }))).status).toBe(403);
  expect(requestShortsService).not.toHaveBeenCalled();
});
it("rejects private fields before touching the collector", async () => {
  expect((await POST(request({ events: [{ ...payload.events[0], email: "private@example.org" }] }))).status).toBe(400);
  expect(requestShortsService).not.toHaveBeenCalled();
});
it("maps analytics HTTP errors without acknowledging the event", async () => {
  const response = await POST(request(payload, "https://www.shortsblockerkids.de", {
    headers: { "Content-Type": "text/plain" },
    body: "not json",
  }));

  expect(response.status).toBe(415);
  await expect(response.json()).resolves.toEqual({ error: "unsupported_media_type" });
  expect(requestShortsService).not.toHaveBeenCalled();
});
it("acknowledges only after the collector commits", async () => {
  vi.mocked(requestShortsService).mockResolvedValue({ inserted: 1 });
  const response = await POST(request(payload));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(requestShortsService).toHaveBeenCalledWith(payload);
});
it("reports unavailable storage instead of acknowledging a lost event", async () => {
  vi.mocked(requestShortsService).mockRejectedValue(new Error("storage unavailable"));
  expect((await POST(request(payload))).status).toBe(503);
});
it("rate limits one trusted client address without blocking another address", async () => {
  vi.stubEnv("ANALYTICS_TRUST_PROXY", "1");
  vi.mocked(requestShortsService).mockResolvedValue({ inserted: 1 });
  const trustedRequest = (address: string) => request(payload, "https://www.shortsblockerkids.de", {
    headers: { "x-forwarded-for": `${address}, 198.51.100.9` },
  });

  for (let i = 0; i < 120; i++) {
    expect((await POST(trustedRequest("203.0.113.7"))).status).toBe(200);
  }

  expect((await POST(trustedRequest("203.0.113.7"))).status).toBe(429);
  expect((await POST(trustedRequest("203.0.113.8"))).status).toBe(200);
  expect(requestShortsService).toHaveBeenCalledTimes(121);
});
