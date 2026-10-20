export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";

export type UmamiEvent =
  | "telegram-click"
  | "amazon-click"
  | "shorts-blocker-click"
  | "hero-cta"
  | "quiz-start"
  | "quiz-complete"
  | "quiz-error"
  | "form-open"
  | "form-success"
  | "form-error";

type UmamiData = Record<string, string | number>;
type UmamiPayload = { url?: string; [key: string]: unknown };

declare global {
  interface Window {
    umami?: { track: (event: UmamiEvent, data?: UmamiData) => void };
    deutschmitUmamiBeforeSend?: typeof umamiBeforeSend;
  }
}

export function track(event: UmamiEvent, data?: UmamiData): void {
  if (typeof window === "undefined" || !UMAMI_WEBSITE_ID) return;
  try { window.umami?.track(event, data); } catch {}
}

export function trackAttributes(event: UmamiEvent, data?: UmamiData) {
  const attributes: Record<string, string | number> = { "data-track": event };
  for (const [key, value] of Object.entries(data ?? {})) {
    attributes[`data-track-${key}`] = value;
  }
  return attributes;
}

export function umamiBeforeSend<T extends UmamiPayload>(_type: string, payload: T): T | false {
  const url = payload.url ?? (typeof location === "undefined" ? "" : location.pathname);
  let pathname = url;
  try { pathname = new URL(url, "https://deutschmit.de").pathname; } catch {}
  return pathname.startsWith("/admin") ? false : payload;
}

export const LEGACY_ANALYTICS_STORAGE_KEYS = {
  localStorage: [
    "deutschmit_analytics_consent_v2",
    "deutschmit_analytics_visitor_v2",
    "quiz_arena_public_analytics_consent_v1",
    "quiz_arena_public_visitor_id_v1",
    "quiz_arena_public_visitor_age_v1",
  ],
  sessionStorage: [
    "deutschmit_analytics_session_v2",
    "deutschmit_analytics_quiz_v2",
  ],
} as const;

export function removeLegacyAnalyticsStorage(): void {
  if (typeof window === "undefined") return;
  for (const storage of ["localStorage", "sessionStorage"] as const) {
    for (const key of LEGACY_ANALYTICS_STORAGE_KEYS[storage]) {
      try { window[storage].removeItem(key); } catch {}
    }
  }
}
