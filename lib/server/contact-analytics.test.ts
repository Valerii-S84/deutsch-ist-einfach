// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sendContactSuccess } from "./contact-analytics";
import { syntheticContactContext } from "@/lib/analytics/fixtures.test-support";
import { parseAnalyticsBatch } from "@/lib/analytics/contract";
vi.mock("server-only", () => ({}));
beforeEach(() => {
  vi.stubEnv("ANALYTICS_SERVICE_URL", "http://analytics:3100");
  vi.stubEnv("ANALYTICS_SERVICE_KEY", "synthetic-private-key-at-least-32-bytes");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ accepted: 1, inserted: 1, duplicates: 0 })));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each(["student", "partner"] as const)("sends one server success for %s with opaque conversion and strict context", async form => {
  const context = syntheticContactContext(form);
  await sendContactSuccess(context);
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("http://analytics:3100/internal/events/server");
  const [event] = parseAnalyticsBatch(JSON.parse(String(init?.body)), "server");
  expect(event.event_name).toBe("form_success");
  expect(event).toMatchObject({ visitor_id: context.visitor_id, session_id: context.session_id, sequence: null, metadata: { form_id: form, submission_attempt_id: context.submission_attempt_id } });
  if (event.event_name !== "form_success") throw new Error("wrong event");
  expect(event.metadata.conversion_id).not.toBe(context.submission_attempt_id);
  expect(event.metadata.conversion_id).not.toBe(event.event_id);
  expect(console.warn).not.toHaveBeenCalled();
});
it("fails once without logging payload, IDs or upstream messages", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("person@example.test private payload"));
  await expect(sendContactSuccess(syntheticContactContext())).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledOnce();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("analytics_contact_delivery_failed");
});
it("bounds even an adapter that ignores abort at 500 ms, without retry", async () => {
  vi.useFakeTimers(); vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  let complete = false;
  const delivery = sendContactSuccess(syntheticContactContext()).then(() => { complete = true; });
  await vi.advanceTimersByTimeAsync(499); expect(complete).toBe(false);
  await vi.advanceTimersByTimeAsync(1); await delivery; expect(complete).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("analytics_contact_delivery_failed");
});
