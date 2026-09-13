import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_STORAGE_KEY, PUBLIC_VISITOR_AGE_STORAGE_KEY, PUBLIC_VISITOR_ID_STORAGE_KEY } from "./analytics";
import { getOrCreatePublicVisitorId } from "./public-analytics-client";

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

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
});
