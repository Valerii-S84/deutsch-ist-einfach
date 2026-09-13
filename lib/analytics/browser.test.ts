import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebsiteAnalytics, telegramClick, PUBLIC_EVENT_DECISIONS } from "./browser";
import { SESSION_KEY, VISITOR_KEY, QUIZ_KEY } from "./identity";

let tracker: WebsiteAnalytics;
let allowed: boolean;
let visible: DocumentVisibilityState;
const fetchSpy = vi.fn();
const captured = () => fetchSpy.mock.calls.flatMap(([, request]) => JSON.parse(request.body).events);
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function click() { tracker.track("hero_cta_click", { cta: "telegram_bot", section: "hero" }); await settle(); }
beforeEach(async () => {
  vi.useFakeTimers(); allowed = true; visible = "visible"; localStorage.clear(); sessionStorage.clear();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ type: "reload" }] as unknown as PerformanceNavigationTiming[]);
  vi.stubGlobal("fetch", fetchSpy.mockReset().mockImplementation(async (_url, request) => {
    const count = JSON.parse(request.body).events.length;
    return new Response(JSON.stringify({ accepted: count, inserted: count, duplicates: 0 }));
  }));
  tracker = new WebsiteAnalytics(() => allowed); tracker.start(); await settle();
});
afterEach(() => { tracker.stop(); document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("page and session lifecycle", () => {
  it("the next action after idle starts a session and page on the open document", async () => {
    await click(); const first = captured()[0];
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1); await click();
    const events = captured(), starts = events.filter(event => event.event_name === "session_start");
    expect(starts).toHaveLength(2); expect(starts[1].session_id).not.toBe(first.session_id); expect(starts[1].visitor_id).toBe(first.visitor_id);
    expect(events.slice(-3).map(event => event.event_name)).toEqual(["session_start", "page_view", "element_click"]);
    expect(events.find(event => event.event_name === "page_leave").metadata.active_ms).toBe(60_000);
    expect(events.slice(-3).map(event => event.sequence)).toEqual([1, 2, 3]);
  });
  it("background time and transport timers never keep a session active", async () => {
    await click(); const saved = sessionStorage.getItem(SESSION_KEY);
    visible = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(sessionStorage.getItem(SESSION_KEY)).toBe(saved);
    visible = "visible"; document.dispatchEvent(new Event("visibilitychange")); await click();
    const leave = captured().find(event => event.event_name === "page_leave"); expect(leave.metadata.active_ms).toBe(0);
    expect(captured().filter(event => event.event_name === "session_start")).toHaveLength(2);
  });
  it("pagehide then hidden/BFCache restore keeps sequence and creates a new view", async () => {
    await click(); const first = captured()[0];
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    visible = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    visible = "visible";
    // Browsers can restore visibility/focus before pageshow.
    document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); await settle(); await click();
    const events = captured(); expect(new Set(events.map(event => event.session_id))).toEqual(new Set([first.session_id]));
    expect(events.filter(event => event.event_name === "page_view")).toHaveLength(2); expect(events.filter(event => event.event_name === "session_start")).toHaveLength(1);
    expect(new Set(events.filter(event => event.event_name === "page_view").map(event => event.page_view_id)).size).toBe(2);
    expect(events.filter(event => event.event_name === "element_click")).toHaveLength(2);
    tracker.navigate("/books"); await settle(); await click();
    expect(captured().filter(event => event.event_name === "page_view").at(-1)?.path).toBe("/books");
    expect(captured().filter(event => event.event_name === "element_click")).toHaveLength(3);
  });
  it("a replaced visitor discards old queue before another action", async () => {
    const old = JSON.parse(localStorage.getItem(VISITOR_KEY)!);
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: crypto.randomUUID(), created: Date.now() }));
    await click(); expect(captured().every(event => event.visitor_id !== old.id)).toBe(true); expect(captured()).toHaveLength(3);
  });
  it("legacy Telegram mappings discard arbitrary payload; every historic event has an explicit decision", () => {
    expect(telegramClick("channel_cta_click", { section: "private email", score: 123 })).toEqual({ element_id: "telegram_channel", placement: "unknown", destination: "telegram" });
    expect(telegramClick("quiz_teaser_cta_clicked", { section: "quiz_teaser", destination: "telegram_bot" })).toMatchObject({ destination: "telegram", placement: "quiz_teaser" });
    expect(telegramClick("hero_cta_click", { cta: "quiz_teaser_anchor" })).toBeNull(); expect(telegramClick("lead_submit_success", {})).toBeNull();
    expect(PUBLIC_EVENT_DECISIONS.quiz_teaser_question_answered).toBe("outside_v1");
    expect(PUBLIC_EVENT_DECISIONS.lead_submit_success).toBe("server_only_form_success");
  });
});

describe("important actions", () => {
  it("maps internal/Telegram explicit actions and ignores answer/client-success payloads", async () => {
    tracker.track("hero_cta_click", { cta: "quiz_teaser_anchor", section: "hero", destination: "https://private.example/person" });
    tracker.track("quiz_teaser_question_answered", { selected_answer_id: "private answer" });
    tracker.track("lead_submit_success", { email: "private@example.test" });
    await click(); await vi.advanceTimersByTimeAsync(0);
    expect(captured().filter(event => event.event_name === "element_click").map(event => event.metadata.destination)).toEqual(["internal", "telegram"]);
    expect(JSON.stringify(captured())).not.toContain("private");
  });
  it("one delegated click has one owner, while a second real click is retained", async () => {
    document.body.innerHTML = '<button data-analytics-id="book_print" data-analytics-placement="books"><span>Private text</span></button><button data-analytics-id="telegram_bot" data-analytics-placement="hero" data-analytics-explicit="true"></button>';
    const nested = document.querySelector("span")!;
    nested.click(); nested.click(); document.querySelectorAll("button")[1].click(); await settle(); await vi.advanceTimersByTimeAsync(0);
    expect(captured().filter(event => event.event_name === "element_click")).toHaveLength(2);
    expect(new Set(captured().map(event => event.event_id)).size).toBe(captured().length);
    expect(JSON.stringify(captured())).not.toContain("Private text");
  });
  it.each(["student", "partner"] as const)("correlates %s open/submit/error and creates new IDs for retry/reopen", async form => {
    tracker.track("wizard_open", { wizard_type: form });
    const context = await tracker.prepareFormSubmission(form); await settle();
    expect(context).toBeDefined();
    tracker.track("form_error", { form_id: form, form_instance_id: context!.form_instance_id, submission_attempt_id: context!.submission_attempt_id, error_code: "network_error" });
    const retry = await tracker.prepareFormSubmission(form); await settle();
    expect(retry!.submission_attempt_id).not.toBe(context!.submission_attempt_id);
    expect(retry!.form_instance_id).toBe(context!.form_instance_id);
    tracker.track("wizard_open", { wizard_type: form });
    const reopened = await tracker.prepareFormSubmission(form); await settle();
    expect(reopened!.form_instance_id).not.toBe(context!.form_instance_id);
    const events = captured();
    expect(events.filter(event => event.event_name === "form_error")[0].metadata.submission_attempt_id).toBe(context!.submission_attempt_id);
    expect(events.some(event => event.event_name === "form_success")).toBe(false);
  });
  it("denial creates no form/run IDs or submission context and does not replay on grant", async () => {
    allowed = false;
    tracker.track("wizard_open", { wizard_type: "student" });
    tracker.track("quiz_teaser_started", { quiz_source: "curated", day_number: 1 });
    expect(await tracker.prepareFormSubmission("student")).toBeUndefined();
    expect(sessionStorage.getItem(QUIZ_KEY)).toBeNull();
    allowed = true; await click();
    expect(captured().some(event => event.event_name === "form_open" || event.event_name === "quiz_started")).toBe(false);
  });
  it("keeps one quiz run across reload/resume and deduplicates completion", async () => {
    const payload = { quiz_source: "curated", day_number: 1 };
    tracker.track("quiz_teaser_started", payload); await settle();
    const run = JSON.parse(sessionStorage.getItem(QUIZ_KEY)!);
    tracker.stop(); tracker = new WebsiteAnalytics(() => allowed); tracker.start(); await settle();
    tracker.track("quiz_teaser_started", payload);
    tracker.track("quiz_teaser_completed", { ...payload, question_index: 5, score: 3 });
    tracker.track("quiz_teaser_completed", { ...payload, question_index: 5, score: 3 }); await settle(); await click();
    expect(captured().filter(event => event.event_name === "quiz_started")).toHaveLength(1);
    expect(captured().filter(event => event.event_name === "quiz_completed")).toHaveLength(1);
    expect(captured().find(event => event.event_name === "quiz_completed").metadata.quiz_run_id).toBe(run.run);
  });
  it("caps fixed frontend errors at five per page view without messages or recursion", async () => {
    for (let i = 0; i < 8; i++) window.dispatchEvent(new ErrorEvent("error", { message: "private@example.test", error: new Error("private stack") }));
    await settle(); await click();
    expect(captured().filter(event => event.event_name === "frontend_error")).toHaveLength(5);
    expect(JSON.stringify(captured())).not.toContain("private");
    tracker.navigate("/contact"); await settle();
    window.dispatchEvent(new Event("unhandledrejection")); await settle(); await click();
    expect(captured().filter(event => event.event_name === "frontend_error")).toHaveLength(6);
  });
});
