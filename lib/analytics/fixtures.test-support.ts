import { EVENT_NAMES, type AnalyticsEventInput, type ContactAnalyticsContext } from "./contract";

export const TEST_ID = "11111111-1111-4111-8111-111111111111";
export const TEST_VISITOR = "22222222-2222-4222-8222-222222222222";
export function syntheticContactContext(form: "student" | "partner" = "student"): ContactAnalyticsContext {
  return { consent: "granted", schema_version: 1, visitor_id: TEST_VISITOR, session_id: TEST_ID,
    page_view_id: "33333333-3333-4333-8333-333333333333", path: "/contact", entry_path: "/",
    form_id: form, form_instance_id: "44444444-4444-4444-8444-444444444444", submission_attempt_id: "55555555-5555-4555-8555-555555555555" };
}
export function syntheticEvent(name: typeof EVENT_NAMES[number] = "page_view", now = Date.now()): AnalyticsEventInput {
  const metadata = {
    session_start: { entry_path: "/" }, page_view: {}, page_leave: { reason: "pagehide", active_ms: 60_000, scroll_percent: 90 },
    element_impression: { element_id: "telegram_cta", placement: "hero" }, element_click: { element_id: "telegram_cta", placement: "hero", destination: "telegram" },
    scroll_depth: { threshold: 90 }, engagement: { active_ms: 60_000 }, article_read: { article_id: "deutsche-sprache-geschichte", rule_version: 1 },
    quiz_started: { quiz_run_id: TEST_ID, quiz_id: "daily" }, quiz_completed: { quiz_run_id: TEST_ID, quiz_id: "daily", answered_count: 5, correct_count: 3 },
    form_open: { form_id: "student", form_instance_id: TEST_ID }, form_submit: { form_id: "student", form_instance_id: TEST_ID, submission_attempt_id: TEST_ID },
    form_success: { form_id: "student", form_instance_id: TEST_ID, submission_attempt_id: TEST_ID, conversion_id: TEST_ID },
    form_error: { form_id: "partner", form_instance_id: TEST_ID, error_code: "network_error" }, frontend_error: { error_code: "unknown_error", component_id: "app" },
  };
  return { product_id: "deutschmit", event_id: TEST_ID, schema_version: 1, visitor_id: TEST_VISITOR, session_id: TEST_ID, page_view_id: TEST_ID, sequence: name === "form_success" ? null : 1, occurred_at: new Date(now).toISOString(), path: "/", event_name: name, metadata: metadata[name] } as AnalyticsEventInput;
}
