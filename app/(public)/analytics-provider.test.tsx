/* @vitest-environment jsdom */
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsProvider, usePublicAnalytics } from "@/app/analytics-provider";
import { AnalyticsSettingsButton } from "@/app/analytics-settings-button";
import { ANALYTICS_CONSENT_STORAGE_KEY, WEBSITE_CONSENT_STORAGE_KEY, PUBLIC_VISITOR_ID_STORAGE_KEY, PUBLIC_VISITOR_AGE_STORAGE_KEY, type AnalyticsMode } from "@/lib/analytics";
import { SESSION_KEY, VISITOR_KEY } from "@/lib/analytics/identity";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
let root: Root;
let container: HTMLDivElement;
const fetchSpy = vi.fn();
const beacon = vi.fn((_url: string, _body: Blob) => true);
let formBasis: unknown;
function Probe() {
  const { trackEvent, prepareFormSubmission } = usePublicAnalytics();
  return <><button onClick={() => trackEvent("hero_cta_click", { cta: "telegram_bot", section: "hero", destination: "https://t.me/example?private=secret" })}>Telegram probe</button><button onClick={async () => { formBasis = (await prepareFormSubmission("student"))?.consent; }}>Form probe</button><AnalyticsSettingsButton /></>;
}
async function mount(mode: AnalyticsMode = "new") {
  await act(async () => { root.render(<StrictMode><AnalyticsProvider mode={mode}><Probe /></AnalyticsProvider></StrictMode>); });
}
async function click(text: string) {
  let button = [...container.querySelectorAll("button")].find(node => node.textContent === text);
  if (!button && ["Analytics erlauben", "Analytics ablehnen", "Einwilligung widerrufen"].includes(text)) {
    const settings = [...container.querySelectorAll("button")].find(node => node.textContent === "Analytics-Einstellungen");
    if (settings) await act(async () => settings.click());
    button = [...container.querySelectorAll("button")].find(node => node.textContent === text);
  }
  expect(button, text).toBeDefined();
  await act(async () => button!.click());
}
const events = () => fetchSpy.mock.calls.flatMap(([, request]) => JSON.parse(request.body).events ?? []);
beforeEach(() => {
  vi.useFakeTimers(); pathname = "/"; localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("fetch", fetchSpy.mockReset().mockImplementation(async (_url, request) => {
    const count = JSON.parse(request.body).events?.length ?? 1;
    return new Response(JSON.stringify({ accepted: count, inserted: count, duplicates: 0 }));
  }));
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon.mockClear() });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("automatic analytics with persistent opt-out", () => {
  it("starts automatically without a consent prompt and sends a page view and new click", async () => {
    await mount();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await click("Telegram probe");
    expect(events().map(event => event.event_name)).toEqual(["session_start", "page_view", "element_click"]);
    expect(new Set(events().map(event => event.session_id)).size).toBe(1);
    expect(JSON.stringify(events())).not.toMatch(/private|secret|https:|page_title/);
    expect(fetchSpy.mock.calls.every(([url]) => url === "/api/public/analytics/events")).toBe(true);
    expect(localStorage.getItem(WEBSITE_CONSENT_STORAGE_KEY)).toBeNull();
  });
  it("preserves an existing refusal without creating an identity or sending events", async () => {
    localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, "denied");
    await mount(); await click("Telegram probe");
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(VISITOR_KEY)).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it("deny and revoke stop collection, delete IDs and discard unsent events; regrant is a new visitor", async () => {
    await mount(); await click("Analytics ablehnen"); await click("Telegram probe");
    expect(fetchSpy).not.toHaveBeenCalled();
    await click("Analytics-Einstellungen"); await click("Analytics erlauben");
    const visitor = localStorage.getItem(VISITOR_KEY);
    await click("Analytics-Einstellungen"); await click("Einwilligung widerrufen");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchSpy).not.toHaveBeenCalled(); expect(localStorage.getItem(VISITOR_KEY)).toBeNull(); expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    await click("Analytics-Einstellungen"); await click("Analytics erlauben"); await click("Telegram probe");
    expect(localStorage.getItem(VISITOR_KEY)).not.toBe(visitor); expect(events()).toHaveLength(3);
  });
  it("receives cross-tab revoke synchronously and cancels pending retries", async () => {
    localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, "granted"); await mount();
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));
    await click("Telegram probe");
    await act(async () => {
      localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, "denied");
      window.dispatchEvent(new StorageEvent("storage", { key: WEBSITE_CONSENT_STORAGE_KEY, newValue: "denied" }));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it("does not duplicate StrictMode mount, same-path rerender, visibility, or hash changes", async () => {
    localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, "granted"); await mount(); await mount();
    await act(async () => { window.dispatchEvent(new Event("hashchange")); document.dispatchEvent(new Event("visibilitychange")); });
    await click("Telegram probe");
    expect(events().filter(event => event.event_name === "page_view")).toHaveLength(1);
    pathname = "/wissen"; await mount(); pathname = "/"; await mount(); await click("Telegram probe");
    expect(events().filter(event => event.event_name === "page_view").map(event => event.path)).toEqual(["/", "/wissen", "/"]);
  });
  it("blocked storage cannot break rendering, consent controls or interactions", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    await mount(); await click("Analytics erlauben"); await click("Telegram probe");
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(fetchSpy).not.toHaveBeenCalled(); expect(container.textContent).toContain("Telegram probe");
  });
  it.each(["new", "legacy", "off"] as const)("collects no Admin actions in mode %s", async mode => {
    localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, "granted"); localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    pathname = "/admin/dashboard"; await mount(mode); await click("Telegram probe");
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(fetchSpy).not.toHaveBeenCalled(); expect(beacon).not.toHaveBeenCalled(); expect(localStorage.getItem(VISITOR_KEY)).toBeNull();
  });
  it("legacy has only the old destination and off has no collection", async () => {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted"); await mount("legacy"); await click("Telegram probe");
    expect(beacon).toHaveBeenCalledTimes(2); expect(beacon.mock.calls.every(([url]) => url === "/api/public/website-analytics/events")).toBe(true);
    await mount("off"); await click("Telegram probe");
    expect(beacon).toHaveBeenCalledTimes(2); expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("legacy revoke clears the ID and its age; regrant starts a new visitor", async () => {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted"); await mount("legacy");
    const first = localStorage.getItem(PUBLIC_VISITOR_ID_STORAGE_KEY); expect(first).not.toBeNull();
    expect(localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY)).not.toBeNull();
    await click("Analytics-Einstellungen"); await click("Einwilligung widerrufen");
    expect(localStorage.getItem(PUBLIC_VISITOR_ID_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY)).toBeNull();
    await click("Analytics-Einstellungen"); await click("Analytics erlauben");
    expect(localStorage.getItem(PUBLIC_VISITOR_ID_STORAGE_KEY)).not.toBe(first);
  });
});

it("marks automatic form tracking without inventing granted consent", async () => {
  formBasis = undefined;
  await mount(); await click("Form probe");
  expect(formBasis).toBe("automatic");
  expect(localStorage.getItem(WEBSITE_CONSENT_STORAGE_KEY)).toBeNull();
});
