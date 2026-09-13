import { z } from "zod";

import { ANALYTICS_PRODUCT, EVENT_NAMES, analyticsId } from "./contract";
import { reportSelectionSchema } from "./report-selection";

export const REPORT_DAYS = [7, 30, 90] as const;
export type AnalyticsReportDays = (typeof REPORT_DAYS)[number];

export function isAnalyticsReportDays(value: number): value is AnalyticsReportDays {
  return REPORT_DAYS.includes(value as AnalyticsReportDays);
}

const isoDate = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative();

export const analyticsOverviewSchema = z.object({
  product_id: z.literal(ANALYTICS_PRODUCT),
  generated_at: isoDate,
  last_received_at: isoDate.nullable(),
  history_available_from: isoDate.nullable(),
  period_start: isoDate,
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  totals: z.object({
    visitors: count,
    sessions: count,
    page_views: count,
    telegram_clicks: count,
    analytics_conversions: count,
  }).strict(),
  daily_series: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    visitors: count,
    sessions: count,
    page_views: count,
    telegram_clicks: count,
    analytics_conversions: count,
  }).strict()),
  top_pages: z.array(z.object({
    path: z.string().min(1),
    page_views: count,
    unique_visitors: count,
    telegram_clicks: count,
  }).strict()),
}).strict();
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;

export const analyticsSessionSummarySchema = z.object({
  session_id: analyticsId,
  started_at: isoDate,
  last_activity_at: isoDate.nullable(),
  status: z.enum(["active", "timed_out", "unknown"]),
  incomplete: z.boolean(),
  first_page: z.string().nullable(),
  last_page: z.string().nullable(),
  entry_source: z.string().min(1),
  page_views: count,
  active_ms: count.nullable(),
  telegram_clicks: count,
  analytics_conversions: count,
  quiz_completions: count,
  event_count: count,
  outcome: z.enum(["conversion", "quiz_completed", "telegram_click", "none"]),
}).strict();
export type AnalyticsSessionSummary = z.infer<typeof analyticsSessionSummarySchema>;

export const analyticsSessionsSchema = z.object({
  product_id: z.literal(ANALYTICS_PRODUCT),
  generated_at: isoDate,
  last_received_at: isoDate.nullable(),
  history_available_from: isoDate.nullable(),
  period_start: isoDate,
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  page: z.number().int().positive(),
  page_size: z.literal(50),
  pages: z.number().int().positive(),
  total: count,
  filters: z.object({
    path: z.string().nullable(),
    event_name: z.enum(EVENT_NAMES).nullable(),
    selection: reportSelectionSchema.optional(),
  }).strict(),
  items: z.array(analyticsSessionSummarySchema),
}).strict();
export type AnalyticsSessions = z.infer<typeof analyticsSessionsSchema>;

export const analyticsSessionEventSchema = z.object({
  product_id: z.literal(ANALYTICS_PRODUCT),
  event_id: analyticsId,
  event_name: z.enum(EVENT_NAMES),
  schema_version: z.literal(1),
  visitor_id: analyticsId,
  session_id: analyticsId,
  page_view_id: analyticsId,
  sequence: z.number().int().positive().nullable(),
  occurred_at: isoDate,
  path: z.string().min(1),
  metadata: z.record(z.unknown()),
  source: z.enum(["browser", "server"]),
  received_at: isoDate,
}).strict();
export type AnalyticsSessionEvent = z.infer<typeof analyticsSessionEventSchema>;

export const analyticsSessionSchema = z.object({
  product_id: z.literal(ANALYTICS_PRODUCT),
  session_id: analyticsId,
  generated_at: isoDate,
  last_received_at: isoDate.nullable(),
  history_available_from: isoDate.nullable(),
  summary: analyticsSessionSummarySchema.nullable(),
  events: z.array(analyticsSessionEventSchema),
}).strict();
export type AnalyticsSession = z.infer<typeof analyticsSessionSchema>;
