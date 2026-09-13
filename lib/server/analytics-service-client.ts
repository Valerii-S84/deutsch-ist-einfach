import "server-only";
import { applicationReportSchemas, type ApplicationReportName } from "@/lib/analytics/application-report-contract";
import type { ReportSelection } from "@/lib/analytics/report-selection";
import { z } from "zod";
import { analyticsEventSchema, analyticsId, ANALYTICS_PRODUCT, parseAnalyticsBatch, type AnalyticsEvent, type EventSource } from "@/lib/analytics/contract";
import { analyticsOverviewSchema, analyticsSessionsSchema, analyticsSessionSummarySchema, type AnalyticsOverview, type AnalyticsReportDays, type AnalyticsSessions } from "@/lib/analytics/report-contract";

export class AnalyticsServiceError extends Error {
  constructor(public status = 503) { super("analytics_unavailable"); }
}
async function serviceRequest(path: string, events?: AnalyticsEvent[]) {
  const key = process.env.ANALYTICS_SERVICE_KEY;
  const configuredUrl = process.env.ANALYTICS_SERVICE_URL;
  if (!key || key.length < 32 || !configuredUrl) throw new AnalyticsServiceError();
  try {
    const base = new URL(configuredUrl);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new AnalyticsServiceError();
    const response = await fetch(new URL(path, base), {
      method: events ? "POST" : "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(path === "/internal/events/server" ? 500 : 4000),
      headers: { Authorization: `Bearer ${key}`, ...(events ? { "Content-Type": "application/json" } : {}) },
      body: events ? JSON.stringify({ events }) : undefined,
    });
    if (!response.ok) throw new AnalyticsServiceError([400, 413, 422, 429].includes(response.status) ? response.status : 503);
    const reader = response.body?.getReader();
    if (!reader) throw new AnalyticsServiceError();
    const parts: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2 * 1024 * 1024 && !/^\/internal\/products\/deutschmit\/sessions\/[0-9a-f-]+$/i.test(path)) throw new AnalyticsServiceError();
        parts.push(value);
      }
      return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown;
    } finally { void reader.cancel().catch(() => {}); }
  } catch (error) {
    throw error instanceof AnalyticsServiceError ? error : new AnalyticsServiceError();
  }
}
export async function sendAnalyticsEvents(events: AnalyticsEvent[], source: EventSource) {
  const validated = parseAnalyticsBatch({ events }, source);
  const payload = await serviceRequest(source === "server" ? "/internal/events/server" : "/internal/events/browser", validated);
  const result = z.object({ accepted: z.number().int().nonnegative(), inserted: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative() }).strict().safeParse(payload);
  if (!result.success || result.data.accepted !== events.length || result.data.inserted + result.data.duplicates !== events.length) throw new AnalyticsServiceError();
  return result.data;
}
const storedEvent = z.object({ source: z.enum(["browser", "server"]), received_at: z.string().datetime({ offset: true }) }).passthrough().transform((value, context) => {
  const { source, received_at, ...event } = value;
  const parsed = analyticsEventSchema.safeParse(event);
  if (!parsed.success || (event.event_name === "form_success") !== (source === "server") || (event.sequence === null) !== (source === "server")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_stored_event" });
    return z.NEVER;
  }
  return { ...parsed.data, source, received_at };
});
const sessionResponse = z.object({
  product_id: z.literal(ANALYTICS_PRODUCT), session_id: analyticsId,
  generated_at: z.string().datetime({ offset: true }), last_received_at: z.string().datetime({ offset: true }).nullable(),
  history_available_from: z.string().datetime({ offset: true }).nullable(),
  summary: analyticsSessionSummarySchema.nullable(), events: z.array(storedEvent),
}).strict();
export async function readAnalyticsSession(sessionId: string) {
  const id = analyticsId.parse(sessionId);
  const payload = await serviceRequest(`/internal/products/deutschmit/sessions/${id}`);
  const parsed = sessionResponse.safeParse(payload);
  if (!parsed.success || parsed.data.session_id !== id || (parsed.data.summary && parsed.data.summary.session_id !== id) || parsed.data.events.some(event => event.session_id !== id)) throw new AnalyticsServiceError();
  return parsed.data;
}

export async function readAnalyticsOverview(days: AnalyticsReportDays): Promise<AnalyticsOverview> {
  const payload = await serviceRequest(`/internal/products/deutschmit/overview?days=${days}`);
  const parsed = analyticsOverviewSchema.safeParse(payload);
  if (!parsed.success || parsed.data.days !== days) throw new AnalyticsServiceError();
  return parsed.data;
}

export async function readAnalyticsSessions(options: {
  selection?: ReportSelection;
  days: AnalyticsReportDays;
  page: number;
  path?: string;
  eventName?: AnalyticsSessions["filters"]["event_name"];
}): Promise<AnalyticsSessions> {
  const query = new URLSearchParams({ days: String(options.days), page: String(options.page) });
  if (options.path) query.set("path", options.path);
  if (options.eventName) query.set("event_name", options.eventName);
  if (options.selection) query.set("selection", JSON.stringify(options.selection));
  const payload = await serviceRequest(`/internal/products/deutschmit/sessions?${query.toString()}`);
  const parsed = analyticsSessionsSchema.safeParse(payload);
  if (parsed.success && JSON.stringify(parsed.data.filters.selection) !== JSON.stringify(options.selection)) throw new AnalyticsServiceError();
  if (!parsed.success || parsed.data.days !== options.days || parsed.data.page !== options.page || parsed.data.filters.path !== (options.path ?? null) || parsed.data.filters.event_name !== (options.eventName ?? null)) throw new AnalyticsServiceError();
  return parsed.data;
}

async function readApplicationReport(name: ApplicationReportName, days: AnalyticsReportDays) {
  const parsed = applicationReportSchemas[name].safeParse(await serviceRequest(`/internal/products/deutschmit/${name}?days=${days}`));
  if (!parsed.success || parsed.data.days !== days) throw new AnalyticsServiceError();
  return parsed.data;
}
export const readAnalyticsPages = (days: AnalyticsReportDays) => readApplicationReport("pages", days);
export const readAnalyticsEvents = (days: AnalyticsReportDays) => readApplicationReport("events", days);
export const readAnalyticsTraffic = (days: AnalyticsReportDays) => readApplicationReport("traffic", days);
export const readAnalyticsConversions = (days: AnalyticsReportDays) => readApplicationReport("conversions", days);
