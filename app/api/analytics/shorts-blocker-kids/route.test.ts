// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/server/shorts-statistics", () => ({ requestShortsService: vi.fn() }));
import { requestShortsService } from "@/lib/server/shorts-statistics";
import { POST } from "./route";
const payload = { events: [{
  event_id: "d8b19e89-bb5e-4a0b-a4b4-f6a3c01d68d7", visitor_id: "0af1b51e-7e9c-4e27-87a7-c5b192afdd89",
  session_id: "0dbb2687-6c58-4f12-9d2e-52497c1ba9bd", page_view_id: "1c0a42ad-7e6b-49e9-8d37-5fe24cc07e69",
  event_name: "page_view", occurred_at: new Date().toISOString(), sequence: 1, path: "/",
  element_id: null, active_ms: null, referrer_host: null, device: "desktop", is_test: false,
}] };
const request = (body: unknown, origin = "https://www.shortsblockerkids.de") => new Request("https://deutschmit.de/api/analytics/shorts-blocker-kids", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => { vi.mocked(requestShortsService).mockReset(); });
it("rejects an unrelated origin before touching the collector", async () => {
  expect((await POST(request(payload, "https://example.org"))).status).toBe(403);
  expect(requestShortsService).not.toHaveBeenCalled();
});
it("rejects private fields before touching the collector", async () => {
  expect((await POST(request({ events: [{ ...payload.events[0], email: "private@example.org" }] }))).status).toBe(400);
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
