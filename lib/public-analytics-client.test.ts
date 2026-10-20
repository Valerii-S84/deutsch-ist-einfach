import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_STORAGE_KEY, PUBLIC_VISITOR_AGE_STORAGE_KEY, PUBLIC_VISITOR_ID_STORAGE_KEY } from "./analytics";
import { getOrCreatePublicVisitorId, sendWebsiteAnalyticsEvent } from "./public-analytics-client";

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("legacy visitor lifetime", () => {
  it.each([90, 91])("rotates at %i days, without extending the creation date on earlier visits", days => {
    const created = Date.now();
    const first = getOrCreatePublicVisitorId(); expect(first).not.toBeNull();
    vi.setSystemTime(created + 90 * 86_400_000 - 1);
    expect(getOrCreatePublicVisitorId()).toBe(first);
    expect(JSON.parse(localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY)!).created).toBe(created);
    vi.setSystemTime(created + days * 86_400_000);
    const next = getOrCreatePublicVisitorId(); expect(next).not.toBeNull(); expect(next).not.toBe(first);
    expect(getOrCreatePublicVisitorId()).toBe(next);
    expect(JSON.parse(localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY)!)).toEqual({ id: next, created: Date.now() });
  });
  it.each([null, "broken", "{}", "null", "42", "[]"])("replaces an existing ID when its age is unknown or invalid: %s", age => {
    const old = crypto.randomUUID(); localStorage.setItem(PUBLIC_VISITOR_ID_STORAGE_KEY, old);
    if (age !== null) localStorage.setItem(PUBLIC_VISITOR_AGE_STORAGE_KEY, age);
    const next = getOrCreatePublicVisitorId(); expect(next).not.toBeNull(); expect(next).not.toBe(old);
    expect(getOrCreatePublicVisitorId()).toBe(next);
  });
  it("rejects a future creation date and metadata belonging to a different ID", () => {
    const first = getOrCreatePublicVisitorId();
    localStorage.setItem(PUBLIC_VISITOR_AGE_STORAGE_KEY, JSON.stringify({ id: first, created: Date.now() + 1 }));
    const next = getOrCreatePublicVisitorId(); expect(next).not.toBe(first);
    localStorage.setItem(PUBLIC_VISITOR_ID_STORAGE_KEY, crypto.randomUUID());
    expect(getOrCreatePublicVisitorId()).not.toBe(next);
  });
  it.each([null, "denied"])("does not create an ID or age before consent: %s", consent => {
    if (consent === null) localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    else localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    expect(getOrCreatePublicVisitorId()).toBeNull();
    expect(localStorage.getItem(PUBLIC_VISITOR_ID_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY)).toBeNull();
  });
  it("blocked persistence does not throw or return an unpersisted ID", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getOrCreatePublicVisitorId()).toBeNull();
  });
  it("falls back to the legacy random ID format when crypto UUID is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const visitorId = getOrCreatePublicVisitorId();

    expect(visitorId).toMatch(/^qa-/);
    expect(localStorage.getItem(PUBLIC_VISITOR_ID_STORAGE_KEY)).toBe(visitorId);
    expect(JSON.parse(localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY)!)).toEqual({
      id: visitorId,
      created: Date.now(),
    });
  });
});

describe("public website analytics transport", () => {
  it("sends a sanitized beacon payload and omits disallowed metadata", async () => {
    window.history.pushState({}, "", "/wissen?utm_source=Newsletter&utm_medium=Email&utm_campaign=Launch");
    const beacon = vi.fn(() => true);
    const fetchSpy = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    vi.stubGlobal("fetch", fetchSpy);

    expect(sendWebsiteAnalyticsEvent({
      eventType: "telegram_cta_click",
      path: "/contact?private=1",
      timestamp: "2026-09-14T10:00:00.000Z",
      metadata: {
        public_event_name: "hero_cta_click",
        cta: "x".repeat(250),
        score: 3,
        article_slug: null,
        ignored_private: "secret",
        section: undefined,
      },
    })).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe("/api/public/website-analytics/events");
    const payload = JSON.parse(await (blob as Blob).text());
    expect(payload).toMatchObject({
      event_type: "telegram_cta_click",
      path: "/contact",
      timestamp: "2026-09-14T10:00:00.000Z",
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "Launch",
      metadata: { public_event_name: "hero_cta_click", score: 3, article_slug: null },
    });
    expect(payload.metadata.cta).toHaveLength(200);
    expect(payload.metadata).not.toHaveProperty("ignored_private");
    expect(payload.metadata).not.toHaveProperty("section");
  });

  it("falls back to keepalive fetch when beacon is unavailable or declined", () => {
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: vi.fn(() => false) });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    expect(sendWebsiteAnalyticsEvent({ eventType: "page_view", metadata: { destination: "telegram", question_index: 2, enabled: true } })).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith("/api/public/website-analytics/events", expect.objectContaining({
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
    }));
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).metadata).toEqual({ destination: "telegram", question_index: 2 });
  });

  it("omits empty sanitized metadata and fails closed when keepalive fetch is blocked", () => {
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: undefined });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    expect(sendWebsiteAnalyticsEvent({
      eventType: "page_view",
      metadata: { ignored_private: "secret", section: undefined },
    })).toBe(true);

    const payload = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(payload.path).toBe(window.location.pathname || "/");
    expect(payload.timestamp).toBe(new Date().toISOString());
    expect(payload).not.toHaveProperty("metadata");

    fetchSpy.mockImplementation(() => { throw new Error("blocked"); });
    expect(sendWebsiteAnalyticsEvent({ eventType: "page_view" })).toBe(false);
  });

  it("fails closed without consent, persistence, beacon or fetch", () => {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    expect(sendWebsiteAnalyticsEvent({ eventType: "page_view" })).toBe(false);

    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: vi.fn(() => { throw new Error("blocked"); }) });
    vi.stubGlobal("fetch", undefined);
    expect(sendWebsiteAnalyticsEvent({ eventType: "page_view" })).toBe(false);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(sendWebsiteAnalyticsEvent({ eventType: "page_view" })).toBe(false);
  });
});
