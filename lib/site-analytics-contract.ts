import { z } from "zod";

export const SITE_ANALYTICS_EVENT_TYPES = [
  "page_view",
  "telegram_cta_click",
] as const;

export const siteAnalyticsEventTypeSchema = z.enum(
  SITE_ANALYTICS_EVENT_TYPES,
);

const metadataValueSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const siteAnalyticsMetadataSchema = z
  .object({
    public_event_name: metadataValueSchema.optional(),
    section: metadataValueSchema.optional(),
    cta: metadataValueSchema.optional(),
    destination: metadataValueSchema.optional(),
    question_index: metadataValueSchema.optional(),
    score: metadataValueSchema.optional(),
    article_slug: metadataValueSchema.optional(),
  })
  .strict();

export const siteAnalyticsEventPayloadSchema = z
  .object({
    event_type: siteAnalyticsEventTypeSchema,
    visitor_id: z.string().min(16).max(128),
    path: z.string(),
    referrer: z.string().max(512).optional(),
    utm_source: z.string().max(160).optional(),
    utm_medium: z.string().max(160).optional(),
    utm_campaign: z.string().max(160).optional(),
    timestamp: z.string().datetime({ offset: true }),
    metadata: siteAnalyticsMetadataSchema.optional(),
  })
  .strict();

export type SiteAnalyticsEventType = z.infer<
  typeof siteAnalyticsEventTypeSchema
>;
export type SiteAnalyticsMetadata = z.infer<
  typeof siteAnalyticsMetadataSchema
>;
export type SiteAnalyticsEventPayload = z.infer<
  typeof siteAnalyticsEventPayloadSchema
>;

export type WebsiteAnalyticsTotals = {
  page_views_total: number;
  unique_visitors_total: number;
  telegram_cta_clicks_total: number;
};

export type WebsiteAnalyticsDailyPoint = {
  date: string;
  unique_visitors: number;
  page_views: number;
  telegram_cta_clicks: number;
};

export type WebsiteAnalyticsTopPage = {
  path: string;
  page_views: number;
  unique_visitors: number;
  telegram_cta_clicks: number;
};

export type WebsiteAnalyticsOverviewData = {
  generated_at: string;
  days: number;
  totals: WebsiteAnalyticsTotals;
  daily_series: WebsiteAnalyticsDailyPoint[];
  top_pages: WebsiteAnalyticsTopPage[];
};
