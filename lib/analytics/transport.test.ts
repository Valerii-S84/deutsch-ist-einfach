import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsTransport } from "./transport";
import { analyticsEventSchema } from "./contract";
import { syntheticEvent } from "./fixtures.test-support";

let transport: AnalyticsTransport;
const fetchSpy = vi.fn();
const event = () => analyticsEventSchema.parse({ ...syntheticEvent(), event_id: crypto.randomUUID() });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchSpy.mockReset().mockImplementation(async (_url, request) => {
    const count = JSON.parse(request.body).events.length;
    return new Response(JSON.stringify({ accepted: count, inserted: count, duplicates: 0 }));
  }));
  transport = new AnalyticsTransport(() => true);
});
afterEach(() => { transport.stop(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe("bounded in-memory transport", () => {
  it("flushes at ten seconds; caps queue at 100 and batches at 20", async () => {
    const inputs = Array.from({ length: 105 }, event); inputs.forEach(item => transport.enqueue(item));
    await vi.advanceTimersByTimeAsync(9999); expect(fetchSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    const batches = fetchSpy.mock.calls.map(([, request]) => JSON.parse(request.body).events);
    expect(batches.map(batch => batch.length)).toEqual([20, 20, 20, 20, 20]);
    expect(batches.flat().map(item => item.event_id)).toEqual(inputs.slice(5).map(item => item.event_id));
  });
  it("counts UTF-8 bytes rather than characters", async () => {
    for (let i = 0; i < 20; i++) transport.enqueue(analyticsEventSchema.parse({ ...event(), metadata: { referrer_host: `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.example`, utm_source: "𐍈".repeat(64), utm_medium: "𐍈".repeat(64), utm_campaign: "𐍈".repeat(128) } }));
    await transport.flush(); await vi.advanceTimersByTimeAsync(10);
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
    for (const [, request] of fetchSpy.mock.calls) expect(new TextEncoder().encode(request.body).length).toBeLessThanOrEqual(32768);
  });
  it.each([429, 500, 503, "network"])("retries %s only after 1/5/15 seconds with the exact IDs, then stops", async status => {
    fetchSpy.mockImplementation(async () => { if (status === "network") throw new TypeError("offline"); return new Response(null, { status: status as number }); });
    const item = event(); transport.enqueue(item); await transport.flush();
    for (const delay of [1000, 5000, 15_000]) {
      const calls = fetchSpy.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1); await transport.flush(); expect(fetchSpy).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1); expect(fetchSpy).toHaveBeenCalledTimes(calls + 1);
    }
    await vi.advanceTimersByTimeAsync(300_000); expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(new Set(fetchSpy.mock.calls.map(([, request]) => request.body)).size).toBe(1);
  });
  it.each([400, 401, 403, 413, 422, 200])("does not retry permanent/invalid-success response %s", async status => {
    fetchSpy.mockResolvedValue(new Response("{}", { status }));
    transport.enqueue(event()); await transport.flush(); await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
  it("drops expired events before fetch and beacon", async () => {
    const item = event(); transport.enqueue(item); vi.setSystemTime(Date.now() + 300_000);
    await transport.flush(); transport.lastAttempt(); expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("beacon is not an ack: resumed fetch retries the same event, not a new one", async () => {
    const beacon = vi.fn(() => true); Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    const item = event(); transport.enqueue(item); transport.lastAttempt(); transport.lastAttempt();
    expect(beacon).toHaveBeenCalledTimes(1); await transport.flush();
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).events[0].event_id).toBe(item.event_id);
  });
  it("revocation aborts in-flight work and cannot resurrect the queue", async () => {
    let signal: AbortSignal | undefined;
    fetchSpy.mockImplementation((_url, request) => { signal = request.signal; return new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new Error("aborted")))); });
    transport.enqueue(event()); const pending = transport.flush(); transport.stop(); await pending;
    expect(signal!.aborted).toBe(true); await vi.advanceTimersByTimeAsync(60_000); expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
