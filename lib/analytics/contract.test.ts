import { describe, expect, it } from "vitest";
import { EVENT_NAMES, normalizeAnalyticsPath, normalizeReferrerHost, normalizeUtm, parseAnalyticsBatch } from "./contract";
import { syntheticEvent } from "./fixtures.test-support";

describe("15-event shared contract", () => {
  it.each(EVENT_NAMES)("accepts %s only from its authorized source", name => {
    const source = name === "form_success" ? "server" : "browser";
    expect(parseAnalyticsBatch({ events: [syntheticEvent(name)] }, source)).toHaveLength(1);
    expect(() => parseAnalyticsBatch({ events: [syntheticEvent(name)] }, source === "server" ? "browser" : "server")).toThrow();
  });
  it.each([
    { product_id: "quiz-arena" }, { schema_version: 2 }, { source: "server" }, { received_at: new Date().toISOString() },
    { event_id: "not-uuid" }, { visitor_id: "email@example.test" }, { session_id: null }, { sequence: -1 }, { sequence: null }, { sequence: 1.5 },
    { path: "x".repeat(2049) }, { metadata: { email: "person@example.test" } }, { event_name: "keypress" }, { cookie: "private" },
  ])("rejects invalid or extra fields %j", change => {
    expect(() => parseAnalyticsBatch({ events: [{ ...syntheticEvent(), ...change }] }, "browser")).toThrow();
  });
  it("rejects a whole batch for one bad item, unknown envelope keys and count limits", () => {
    for (const payload of [{ events: [] }, { events: Array(21).fill(syntheticEvent()) }, { events: [syntheticEvent(), { ...syntheticEvent(), metadata: { extra: true } }] }, { events: [syntheticEvent()], product_id: "deutschmit" }]) expect(() => parseAnalyticsBatch(payload, "browser")).toThrow();
  });
  it("enforces inclusive timestamp boundaries", () => {
    const now = Date.now();
    for (const offset of [-300_000, 60_000]) expect(parseAnalyticsBatch({ events: [syntheticEvent("page_view", now + offset)] }, "browser", now)).toHaveLength(1);
    for (const offset of [-300_001, 60_001]) expect(() => parseAnalyticsBatch({ events: [syntheticEvent("page_view", now + offset)] }, "browser", now)).toThrow();
  });
  it("bounds event metadata and checks counts", () => {
    for (const [name, metadata] of [["engagement", { active_ms: 86_400_001 }], ["scroll_depth", { threshold: 42 }], ["quiz_completed", { ...syntheticEvent("quiz_completed").metadata, correct_count: 6 }], ["form_error", { ...syntheticEvent("form_error").metadata, message: "private" }]] as const) expect(() => parseAnalyticsBatch({ events: [{ ...syntheticEvent(), event_name: name, metadata }] }, "browser")).toThrow();
  });
  it("maps unknown frontend errors to a fixed code without persisting the message", () => {
    const [event] = parseAnalyticsBatch({ events: [{ ...syntheticEvent("frontend_error"), metadata: { error_code: "unexpected private message", component_id: "quiz" } }] }, "browser");
    expect(event.metadata).toEqual({ error_code: "unknown_error", component_id: "quiz" });
  });
});
describe("privacy normalization", () => {
  it("accepts new campaigns without configuration and decodes once", () => {
    const params = new URL("https://example.test/?utm_source=Instagram&utm_medium=Paid%20Social&utm_campaign=Herbst%20Kurs%202026").searchParams;
    expect([normalizeUtm(params.get("utm_source")!, "source"), normalizeUtm(params.get("utm_medium")!, "medium"), normalizeUtm(params.get("utm_campaign")!, "campaign")]).toEqual(["instagram", "paid-social", "Herbst-Kurs-2026"]);
    expect(normalizeUtm("Літній курс", "campaign")).toBe("Літній-курс");
    expect(normalizeUtm("ＩＮＳＴＡＧＲＡＭ", "source")).toBe("instagram");
  });
  it.each(["mail@example.test", "+49 123 456789", "0049-123-456789", "https://example.test", "www.example.test", "<b>text</b>", "abc\n", "abc\u200b", "%2520", "value%40mail", "a".repeat(257)])("rejects unsafe UTM %s", value => expect(normalizeUtm(value, "campaign")).toBe("unknown"));
  it("checks lengths without truncation, preserves missing values", () => {
    for (const field of ["source", "medium", "campaign"] as const) {
      const limit = field === "campaign" ? 128 : 64;
      expect(normalizeUtm("a".repeat(limit), field)).toHaveLength(limit);
      expect(normalizeUtm("a".repeat(limit + 1), field)).toBe("unknown");
      expect(normalizeUtm("  ", field)).toBeUndefined();
    }
  });
  it("stores safe session context and drops arbitrary paths and referrers", () => {
    expect(normalizeAnalyticsPath("/wissen?email=private#part")).toBe("/wissen");
    for (const path of ["", "#hash", "?private=value", "unknown"]) expect(normalizeAnalyticsPath(path)).toBe("unknown");
    expect(normalizeAnalyticsPath("/admin/users")).toBe("unknown");
    expect(normalizeAnalyticsPath("/artikel/unrecognized-private-value")).toBe("unknown");
    expect(normalizeReferrerHost("Search.Example.com")).toBe("search.example.com");
    expect(normalizeReferrerHost("deutschmit.de")).toBeUndefined();
    for (const value of ["https://search.example.com/private", "user@example.com", "127.0.0.1", "localhost"]) expect(normalizeReferrerHost(value)).toBe("unknown");
    const [event] = parseAnalyticsBatch({ events: [{ ...syntheticEvent(), metadata: { utm_campaign: "new-campaign", utm_source: "private@email.test" } }] }, "browser");
    expect(event.metadata).toEqual({ utm_campaign: "new-campaign", utm_source: "unknown" });
  });
});
