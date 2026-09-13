import { z } from "zod";
import { ANALYTICS_PRODUCT, EVENT_NAMES } from "./contract";
import { analyticsOverviewSchema } from "./report-contract";

import { reportLabel as label, trafficDimensions } from "./report-selection";
export { parseReportSelection, reportSelectionSchema, type ReportSelection } from "./report-selection";
const count = z.number().int().nonnegative();
const base = analyticsOverviewSchema.omit({ totals: true, daily_series: true, top_pages: true });
export const analyticsPagesSchema = base.extend({ items: z.array(z.object({
  path: z.string().min(1), page_views: count, visitors: count, measured_views: count,
  average_active_ms: z.number().nonnegative().nullable(), max_scroll: z.number().min(0).max(100).nullable(), article_reads: count,
}).strict()) }).strict();
export const analyticsEventsSchema = base.extend({
  events: z.array(z.object({ event_name: z.enum(EVENT_NAMES), count }).strict()),
  elements: z.array(z.object({ element_id: label, placement: label, impressions: count, clicks: count, matched_click_views: count, unmatched_clicks: count }).strict()),
  errors: z.array(z.object({ error_code: label, component_id: label, count }).strict()),
}).strict();
export const analyticsTrafficSchema = base.extend({ items: z.array(z.object({
  ...trafficDimensions, source_kind: z.enum(["direct", "unknown", "attributed"]), sessions: count, converted_sessions: count, analytics_conversions: count,
}).strict()) }).strict();
export const analyticsConversionsSchema = base.extend({
  forms: z.array(z.object({ form_id: z.enum(["student", "partner"]), opens: count, submits: count, successes: count, errors: count }).strict()),
  quizzes: z.array(z.object({ quiz_id: label, starts: count, completions: count }).strict()),
  intents: z.array(z.object({ destination: z.enum(["telegram", "youtube", "amazon", "download", "other"]), clicks: count }).strict()),
}).strict();
export const applicationReportSchemas = { pages: analyticsPagesSchema, events: analyticsEventsSchema, traffic: analyticsTrafficSchema, conversions: analyticsConversionsSchema };
export type ApplicationReportName = keyof typeof applicationReportSchemas;
export type AnalyticsPages = z.infer<typeof analyticsPagesSchema>;
export type AnalyticsEvents = z.infer<typeof analyticsEventsSchema>;
export type AnalyticsTraffic = z.infer<typeof analyticsTrafficSchema>;
export type AnalyticsConversions = z.infer<typeof analyticsConversionsSchema>;
export type ApplicationReport = AnalyticsPages | AnalyticsEvents | AnalyticsTraffic | AnalyticsConversions;
export { ANALYTICS_PRODUCT };
