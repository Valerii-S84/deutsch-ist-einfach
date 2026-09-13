import postgres from "postgres";

import type { SiteAnalyticsEventPayload, WebsiteAnalyticsOverviewData } from "@/lib/site-analytics-contract";

let databaseClient: ReturnType<typeof postgres> | undefined;

function getDatabaseClient(): ReturnType<typeof postgres> {
  if (databaseClient) {
    return databaseClient;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for site analytics persistence");
  }

  databaseClient = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return databaseClient;
}

export async function saveSiteAnalyticsEvent(
  payload: SiteAnalyticsEventPayload,
): Promise<void> {
  const sql = getDatabaseClient();

  await sql`
    INSERT INTO website_analytics_events (
      event_type,
      visitor_id,
      path,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      event_timestamp,
      metadata
    )
    VALUES (
      ${payload.event_type},
      ${payload.visitor_id},
      ${payload.path},
      ${payload.referrer ?? null},
      ${payload.utm_source ?? null},
      ${payload.utm_medium ?? null},
      ${payload.utm_campaign ?? null},
      ${payload.timestamp},
      ${payload.metadata === undefined ? null : sql.json(payload.metadata)}
    )
  `;
}

export async function readSiteAnalyticsOverview(days: number): Promise<WebsiteAnalyticsOverviewData> {
  if (![7, 30, 90].includes(days)) {
    throw new Error("Invalid analytics period");
  }

  const generatedAt = new Date();
  const start = new Date(generatedAt);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const sql = getDatabaseClient();

  // One database snapshot; count distinct visitors over the entire period,
  // independently of the per-day and per-page counts.
  const [row] = await sql<{ overview: WebsiteAnalyticsOverviewData }[]>`
    WITH events AS (
      SELECT event_type, visitor_id, path, event_timestamp
      FROM website_analytics_events
      WHERE event_timestamp >= ${start.toISOString()}::timestamptz
        AND event_timestamp <= ${generatedAt.toISOString()}::timestamptz
    ), daily AS (
      SELECT to_char(event_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        count(DISTINCT visitor_id) AS unique_visitors,
        count(*) FILTER (WHERE event_type = 'page_view') AS page_views,
        count(*) FILTER (WHERE event_type = 'telegram_cta_click') AS telegram_cta_clicks
      FROM events
      GROUP BY 1
    ), pages AS (
      SELECT path,
        count(*) FILTER (WHERE event_type = 'page_view') AS page_views,
        count(DISTINCT visitor_id) AS unique_visitors,
        count(*) FILTER (WHERE event_type = 'telegram_cta_click') AS telegram_cta_clicks
      FROM events
      GROUP BY path
      ORDER BY page_views DESC, path ASC
      LIMIT 10
    )
    SELECT json_build_object(
      'generated_at', ${generatedAt.toISOString()}::text,
      'days', ${days}::integer,
      'totals', (
        SELECT json_build_object(
          'page_views_total', count(*) FILTER (WHERE event_type = 'page_view'),
          'unique_visitors_total', count(DISTINCT visitor_id),
          'telegram_cta_clicks_total', count(*) FILTER (WHERE event_type = 'telegram_cta_click')
        ) FROM events
      ),
      'daily_series', COALESCE((SELECT json_agg(daily ORDER BY date) FROM daily), '[]'::json),
      'top_pages', COALESCE((SELECT json_agg(pages ORDER BY page_views DESC, path ASC) FROM pages), '[]'::json)
    ) AS overview
  `;

  return row.overview;
}
