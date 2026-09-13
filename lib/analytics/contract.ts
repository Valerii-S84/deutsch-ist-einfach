import { z } from "zod";
import { ARTICLE_EMBEDS } from "../article-definitions";

export const ANALYTICS_PRODUCT = "deutschmit" as const;
export const MAX_BATCH_BYTES = 32 * 1024;
export const MAX_BATCH_EVENTS = 20;
export const EVENT_NAMES = ["session_start", "page_view", "page_leave", "element_impression", "element_click", "scroll_depth", "engagement", "article_read", "quiz_started", "quiz_completed", "form_open", "form_submit", "form_success", "form_error", "frontend_error"] as const;
export type EventSource = "browser" | "server";
export const analyticsId = z.string().uuid().transform(value => value.toLowerCase());

const publicPaths = new Set(["/", "/wissen", "/projects", "/books", "/contact", "/privacy", "/impressum", "/artikel/[slug]", ...Object.keys(ARTICLE_EMBEDS).map(slug => `/artikel/${slug}`)]);
export function normalizeAnalyticsPath(value: string): string {
  if (!value.startsWith("/")) return "unknown";
  const path = value.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  return publicPaths.has(path) ? path : "unknown";
}

// Input is already decoded once by URLSearchParams. Never decode it again.
export function normalizeUtm(value: string | undefined, field: "source" | "medium" | "campaign"): string | undefined {
  if (value === undefined || value === "") return undefined;
  if ([...value].length > 256) return "unknown";
  const normalized = value.normalize("NFKC");
  if (/[\p{Cc}\p{Cf}]/u.test(normalized)) return "unknown";
  const trimmed = normalized.trim();
  if (!trimmed) return undefined;
  if (!/^[\p{L}\p{N} ._-]+$/u.test(trimmed) || /(?:\d[ ._-]*){7,}/u.test(trimmed) || /^(?:https?|www)[._-]/i.test(trimmed)) return "unknown";
  const result = trimmed.replace(/ +/g, "-");
  const label = field === "campaign" ? result : result.toLowerCase();
  return [...label].length > (field === "campaign" ? 128 : 64) ? "unknown" : label;
}

export function normalizeReferrerHost(value: string): string | undefined {
  if (!value) return undefined;
  const host = value.toLowerCase();
  if (["deutschmit.de", "www.deutschmit.de"].includes(host)) return undefined;
  if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return "unknown";
  return host;
}

const pathSchema = z.string().max(2048).transform(normalizeAnalyticsPath);
const labelId = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/);
const counter = z.number().int().min(0).max(2147483647);
const activeMs = z.number().int().min(0).max(86_400_000);
const scroll = z.number().int().min(0).max(100);
export const trafficFields = {
  entry_path: pathSchema.optional(),
  referrer_host: z.string().transform(normalizeReferrerHost).optional(),
  utm_source: z.string().transform(value => normalizeUtm(value, "source")).optional(),
  utm_medium: z.string().transform(value => normalizeUtm(value, "medium")).optional(),
  utm_campaign: z.string().transform(value => normalizeUtm(value, "campaign")).optional(),
};
// This optional transport context is parsed separately from the contact record.
export const contactAnalyticsContextSchema = z.object({
  consent: z.literal("granted"), schema_version: z.literal(1),
  visitor_id: analyticsId, session_id: analyticsId, page_view_id: analyticsId,
  path: pathSchema, form_id: z.enum(["student", "partner"]),
  form_instance_id: analyticsId, submission_attempt_id: analyticsId,
  ...trafficFields,
}).strict();
export type ContactAnalyticsContext = z.output<typeof contactAnalyticsContextSchema>;
export type AnalyticsFormId = ContactAnalyticsContext["form_id"];
const form = { form_id: z.enum(["student", "partner"]), form_instance_id: analyticsId };
const element = { element_id: labelId, placement: labelId };
const quiz = { quiz_run_id: analyticsId, quiz_id: labelId };
const common = {
  product_id: z.literal(ANALYTICS_PRODUCT).default(ANALYTICS_PRODUCT),
  event_id: analyticsId,
  schema_version: z.literal(1),
  visitor_id: analyticsId,
  session_id: analyticsId,
  page_view_id: analyticsId,
  sequence: counter.refine(value => value > 0).nullable(),
  occurred_at: z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString()),
  path: pathSchema,
};
function event<T extends typeof EVENT_NAMES[number], S extends z.ZodRawShape>(name: T, fields: S) {
  return z.object({ ...common, event_name: z.literal(name), metadata: z.object({ ...trafficFields, ...fields }).strict() }).strict();
}
const frontendCodes = ["js_error", "unhandled_rejection", "quiz_network_error", "quiz_server_error", "quiz_invalid_response", "unknown_error"] as const;
export const analyticsEventSchema = z.discriminatedUnion("event_name", [
  event("session_start", { entry_path: pathSchema }),
  event("page_view", {}),
  event("page_leave", { reason: z.enum(["navigation", "pagehide"]), active_ms: activeMs, scroll_percent: scroll }),
  event("element_impression", element),
  event("element_click", { ...element, destination: z.enum(["internal", "telegram", "youtube", "amazon", "download", "other"]) }),
  event("scroll_depth", { threshold: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(90)]) }),
  event("engagement", { active_ms: activeMs }),
  event("article_read", { article_id: z.enum(Object.keys(ARTICLE_EMBEDS) as [string, ...string[]]), rule_version: z.literal(1) }),
  event("quiz_started", quiz),
  event("quiz_completed", { ...quiz, answered_count: z.number().int().min(1).max(1000), correct_count: z.number().int().min(0).max(1000) }),
  event("form_open", form),
  event("form_submit", { ...form, submission_attempt_id: analyticsId }),
  event("form_success", { ...form, submission_attempt_id: analyticsId, conversion_id: analyticsId }),
  event("form_error", { ...form, submission_attempt_id: analyticsId.optional(), error_code: z.enum(["validation_error", "network_error", "server_error", "rate_limited", "unknown_error"]) }),
  event("frontend_error", { error_code: z.string().max(128).transform(value => frontendCodes.includes(value as typeof frontendCodes[number]) ? value as typeof frontendCodes[number] : "unknown_error"), component_id: z.enum(["app", "quiz", "contact", "unknown"]) }),
]);
export type AnalyticsEvent = z.output<typeof analyticsEventSchema>;
export type AnalyticsEventInput = z.input<typeof analyticsEventSchema>;
export const analyticsBatchSchema = z.object({ events: z.array(analyticsEventSchema).min(1).max(MAX_BATCH_EVENTS) }).strict();

export function parseAnalyticsBatch(payload: unknown, source: EventSource, now = Date.now()): AnalyticsEvent[] {
  const { events } = analyticsBatchSchema.parse(payload);
  for (const item of events) {
    const occurredAt = Date.parse(item.occurred_at);
    if (occurredAt < now - 300_000 || occurredAt > now + 60_000) throw new Error("invalid_event_time");
    if ((item.event_name === "form_success") !== (source === "server")) throw new Error("invalid_event_source");
    if ((item.sequence === null) !== (source === "server")) throw new Error("invalid_sequence");
    if (item.event_name === "quiz_completed" && item.metadata.correct_count > item.metadata.answered_count) throw new Error("invalid_quiz_counts");
  }
  return events;
}
