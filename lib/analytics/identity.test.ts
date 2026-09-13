import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsIdentity, readTraffic, SESSION_KEY, SESSION_TIMEOUT, VISITOR_KEY } from "./identity";

let identities: AnalyticsIdentity[];
const create = () => { const identity = new AnalyticsIdentity(() => true); identities.push(identity); return identity; };
function enableLocks() {
  const held = new Set<string>();
  const request = vi.fn(async (name: string, optionsOrCallback: unknown, callback?: (lock: object | null) => unknown) => {
    const run = (callback ?? optionsOrCallback) as (lock: object | null) => unknown;
    if (held.has(name)) return run(null);
    held.add(name);
    try { return await run({ name }); } finally { held.delete(name); }
  });
  vi.stubGlobal("navigator", Object.create(navigator, { locks: { value: { request } } }));
  return held;
}
beforeEach(() => {
  vi.useFakeTimers(); identities = []; localStorage.clear(); sessionStorage.clear();
  vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(1000);
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ type: "reload" }] as unknown as PerformanceNavigationTiming[]);
});
afterEach(() => { identities.forEach(identity => identity.stop()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("visitor and tab session identity", () => {
  it("reload restores session and sequence; timeout rotates session with same visitor", async () => {
    const first = create(); expect(await first.initialize()).toBe(true);
    first.session!.sequence = 4; first.save();
    const saved = { ...first.session! }; first.stop();
    const reload = create(); expect(await reload.initialize()).toBe(true); expect(reload.session).toEqual(saved); reload.stop();
    vi.setSystemTime(Date.now() + SESSION_TIMEOUT);
    const next = create(); expect(await next.initialize()).toBe(true);
    expect(next.session!.visitor).toBe(saved.visitor); expect(next.session!.id).not.toBe(saved.id); expect(next.session!.sequence).toBe(0);
  });
  it("90-day visitor rotation also starts a fresh session", async () => {
    const first = create(); await first.initialize(); const saved = first.session!; first.stop();
    vi.setSystemTime(Date.now() + 90 * 86_400_000);
    const next = create(); await next.initialize(); expect(next.session!.visitor).not.toBe(saved.visitor); expect(next.session!.id).not.toBe(saved.id);
  });
  it("a cloned new document is a new session without Web Locks", async () => {
    const first = create(); await first.initialize(); const saved = first.session!; first.stop();
    vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(2000);
    vi.mocked(performance.getEntriesByType).mockReturnValue([{ type: "navigate" }] as unknown as PerformanceNavigationTiming[]);
    const duplicate = create(); await duplicate.initialize();
    expect(duplicate.session!.visitor).toBe(saved.visitor); expect(duplicate.session!.id).not.toBe(saved.id);
  });
  it.each(["navigate", "reload"])("a cloned tab with %s timing starts fresh even after its opener releases the lock", async type => {
    const held = enableLocks();
    const first = create(); await first.initialize(); first.session!.sequence = 7; first.save(); const saved = first.session!;
    first.stop(); await Promise.resolve();
    expect(held.has(`deutschmit-analytics-session-${saved.id}`)).toBe(false);
    vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(2000);
    vi.mocked(performance.getEntriesByType).mockReturnValue([{ type }] as unknown as PerformanceNavigationTiming[]);
    vi.stubGlobal("navigation", { activation: { from: null } });
    const duplicate = create(); expect(await duplicate.initialize()).toBe(true);
    expect(duplicate.session!.visitor).toBe(saved.visitor); expect(duplicate.session!.id).not.toBe(saved.id);
    expect(duplicate.session!.sequence).toBe(0);
  });
  it.each(["reload", "navigate", "back_forward"])("a same-tab %s preserves session and sequence after the lock is released", async type => {
    enableLocks(); const first = create(); await first.initialize(); first.session!.sequence = 5; first.save(); const saved = first.session!;
    first.stop(); await Promise.resolve();
    vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(2000);
    vi.mocked(performance.getEntriesByType).mockReturnValue([{ type }] as unknown as PerformanceNavigationTiming[]);
    vi.stubGlobal("navigation", { activation: { from: { id: "previous-entry" } } });
    const next = create(); expect(await next.initialize()).toBe(true);
    expect(next.session).toMatchObject({ id: saved.id, visitor: saved.visitor, sequence: 5 });
  });
  it("an occupied lock rejects copied state even if navigation suggests a continuing tab", async () => {
    enableLocks(); const first = create(); await first.initialize(); const saved = first.session!;
    vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(2000);
    const duplicate = create(); expect(await duplicate.initialize()).toBe(true);
    expect(duplicate.session!.id).not.toBe(saved.id); expect(duplicate.session!.visitor).toBe(saved.visitor);
  });
  it("restarting within the initial document preserves its session with no previous navigation entry", async () => {
    vi.stubGlobal("navigation", { activation: { from: null } });
    const first = create(); await first.initialize(); const saved = first.session!; first.stop();
    const next = create(); expect(await next.initialize()).toBe(true); expect(next.session!.id).toBe(saved.id);
  });
  it("storage failures create no IDs and do not throw", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(await create().initialize()).toBe(false); expect(localStorage.getItem(VISITOR_KEY)).toBeNull(); expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it("cancelled initialization cannot write IDs or restore a session", async () => {
    const identity = create(); identity.stop(); expect(await identity.initialize()).toBe(false); expect(localStorage.getItem(VISITOR_KEY)).toBeNull();
  });
  it("rejects tampered session state and cleans attribution at capture", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: "private data" }));
    window.history.replaceState({}, "", "/wissen?utm_source=Instagram&utm_medium=Paid%20Social&utm_campaign=Herbst%20Kurs%202026#private");
    expect(readTraffic()).toMatchObject({ entry_path: "/wissen", utm_source: "instagram", utm_medium: "paid-social", utm_campaign: "Herbst-Kurs-2026" });
    const identity = create(); expect(await identity.initialize()).toBe(true); expect(JSON.stringify(identity.session)).not.toContain("private");
    window.history.replaceState({}, "", "/");
  });
});
