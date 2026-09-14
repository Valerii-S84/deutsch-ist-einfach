export const ANALYTICS_CONSENT_STORAGE_KEY = "quiz_arena_public_analytics_consent_v1";
export const PUBLIC_VISITOR_ID_STORAGE_KEY = "quiz_arena_public_visitor_id_v1";
export const PUBLIC_VISITOR_AGE_STORAGE_KEY = "quiz_arena_public_visitor_age_v1";
export const WEBSITE_CONSENT_STORAGE_KEY = "deutschmit_analytics_consent_v2";
export type AnalyticsConsent = "pending" | "automatic" | "granted" | "denied";
export type AnalyticsMode = "legacy" | "new" | "off";

export function getAnalyticsMode(): AnalyticsMode {
  const mode = process.env.NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE;
  return mode === "new" || mode === "off" || mode === "legacy" ? mode : "legacy";
}

export type PublicAnalyticsEventName =
  | "hero_cta_click"
  | "channel_cta_click"
  | "wizard_open"
  | "lead_submit_success"
  | "quiz_teaser_started"
  | "quiz_teaser_question_answered"
  | "quiz_teaser_completed"
  | "quiz_teaser_cta_clicked"
  | "quiz_teaser_error"
  | "form_error";

export type PublicAnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

export type WebsiteAnalyticsEventType = "page_view" | "telegram_cta_click";
