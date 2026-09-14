import { ANALYTICS_PRODUCT, analyticsId } from "../../../lib/analytics/contract";
import { analyticsOverviewSchema, analyticsSessionsSchema, type AnalyticsReportDays, type AnalyticsSessions, type AnalyticsOverview } from "../../../lib/analytics/report-contract";
import type { AnalyticsDatabase } from "./database";
import { selectionPredicate } from "./application-reports";
import type { ReportSelection } from "../../../lib/analytics/report-selection";

// Both reports summarize the entire stored session, after selecting its ID.
function sessionSummaries(sql: AnalyticsDatabase) {
  return sql`active_per_view AS (
    SELECT session_id, page_view_id,
      max((metadata->>'active_ms')::bigint) AS active_ms
    FROM session_events WHERE event_name IN ('engagement', 'page_leave')
    GROUP BY session_id, page_view_id
  ), active_per_session AS (
    SELECT session_id, sum(active_ms) AS active_ms FROM active_per_view GROUP BY session_id
  ), entries AS (
    SELECT DISTINCT ON (session_id) session_id, metadata
    FROM session_events
    ORDER BY session_id, sequence NULLS LAST, occurred_at, event_id
  ), summaries AS (
    SELECT e.session_id, min(e.occurred_at) AS started_at,
      max(e.occurred_at) FILTER (WHERE e.source = 'browser') AS last_activity_at,
      (array_agg(e.path ORDER BY e.sequence NULLS LAST, e.occurred_at, e.event_id))[1] AS first_page,
      (array_agg(e.path ORDER BY e.sequence DESC NULLS LAST, e.occurred_at DESC, e.event_id DESC))[1] AS last_page,
      CASE
        WHEN 'unknown' IN (entry.metadata->>'utm_source', entry.metadata->>'utm_medium', entry.metadata->>'utm_campaign', entry.metadata->>'referrer_host') THEN 'unknown'
        WHEN concat_ws('', entry.metadata->>'utm_source', entry.metadata->>'utm_medium', entry.metadata->>'utm_campaign') <> ''
          THEN concat_ws(' / ', entry.metadata->>'utm_source', entry.metadata->>'utm_medium', entry.metadata->>'utm_campaign')
        ELSE COALESCE(entry.metadata->>'referrer_host', 'direct')
      END AS entry_source,
      count(DISTINCT e.page_view_id) FILTER (WHERE e.event_name = 'page_view')::int AS page_views,
      max(a.active_ms) AS active_ms,
      count(*) FILTER (WHERE e.event_name = 'element_click' AND e.metadata->>'destination' = 'telegram')::int AS telegram_clicks,
      count(DISTINCT e.metadata->>'conversion_id') FILTER (WHERE e.event_name = 'form_success' AND e.source = 'server')::int AS analytics_conversions,
      count(DISTINCT e.metadata->>'quiz_run_id') FILTER (WHERE e.event_name = 'quiz_completed')::int AS quiz_completions,
      count(*)::int AS event_count,
      (count(*) FILTER (WHERE e.event_name = 'session_start') = 0
        OR count(DISTINCT e.sequence) < max(e.sequence)) AS incomplete
    FROM session_events e JOIN entries entry USING (session_id) LEFT JOIN active_per_session a USING (session_id)
    GROUP BY e.session_id, entry.metadata
  ), with_outcome AS (
    SELECT s.*,
      CASE WHEN s.last_activity_at IS NULL THEN 'unknown'
        WHEN s.last_activity_at <= b.generated_at - interval '30 minutes' THEN 'timed_out'
        ELSE 'active' END AS status,
      CASE WHEN s.analytics_conversions > 0 THEN 'conversion'
        WHEN s.quiz_completions > 0 THEN 'quiz_completed'
        WHEN s.telegram_clicks > 0 THEN 'telegram_click'
        ELSE 'none' END AS outcome
    FROM summaries s, bounds b
  )`;
}

export async function readSession(sql: AnalyticsDatabase, sessionId: string) {
  const id = analyticsId.parse(sessionId);
  const [result] = await sql`
    WITH bounds AS (SELECT statement_timestamp() AS generated_at), session_events AS (
      SELECT * FROM analytics_report_events WHERE product_id = ${ANALYTICS_PRODUCT} AND session_id = ${id}::uuid
    ), ${sessionSummaries(sql)}, browser_order AS (
      SELECT event_id, metadata->>'submission_attempt_id' AS attempt_id, sequence,
        max(occurred_at) OVER (ORDER BY sequence, occurred_at, event_id) AS sort_at
      FROM session_events WHERE source = 'browser'
    ), ordered_events AS (
      SELECT e.*, COALESCE(b.sort_at, greatest(e.occurred_at, submit.sort_at)) AS sort_at,
        COALESCE(e.sequence::numeric, submit.sequence + 0.5) AS sort_sequence
      FROM session_events e LEFT JOIN browser_order b USING (event_id)
      LEFT JOIN LATERAL (
        SELECT sort_at, sequence FROM browser_order
        WHERE e.source = 'server' AND attempt_id = e.metadata->>'submission_attempt_id'
        ORDER BY sequence LIMIT 1
      ) submit ON true
    )
    SELECT b.generated_at,
      (SELECT max(received_at) FROM session_events) AS last_received_at,
      (SELECT min(occurred_at) FROM analytics_report_events WHERE product_id = ${ANALYTICS_PRODUCT}) AS history_available_from,
      (SELECT to_json(s) FROM with_outcome s) AS summary,
      COALESCE((SELECT json_agg(to_jsonb(e) - 'sort_at' - 'sort_sequence'
        ORDER BY sort_at, sort_sequence NULLS LAST, event_id) FROM ordered_events e), '[]'::json) AS events
    FROM bounds b
  `;
  return { product_id: ANALYTICS_PRODUCT, session_id: id, ...result };
}

type ReportRow = {
  generated_at: Date | string;
  period_start: Date | string;
  last_received_at: Date | string | null;
  history_available_from: Date | string | null;
  totals?: unknown;
  daily_series?: unknown;
  top_pages?: unknown;
  total?: number;
  items?: unknown;
};

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function readOverview(sql: AnalyticsDatabase, days: AnalyticsReportDays): Promise<AnalyticsOverview> {
  const [row] = await sql<ReportRow[]>`
    WITH bounds AS (
      SELECT statement_timestamp() AS generated_at,
        (date_trunc('day', statement_timestamp() AT TIME ZONE 'UTC')
          - (${days}::int - 1) * interval '1 day') AT TIME ZONE 'UTC' AS period_start
    ), events AS (
      SELECT e.*
      FROM analytics_report_events e, bounds b
      WHERE e.product_id = ${ANALYTICS_PRODUCT}
        AND e.occurred_at >= b.period_start
        AND e.occurred_at < b.generated_at
    ), calendar AS (
      SELECT generate_series(
        b.period_start AT TIME ZONE 'UTC',
        date_trunc('day', b.generated_at AT TIME ZONE 'UTC'),
        interval '1 day'
      ) AT TIME ZONE 'UTC' AS day
      FROM bounds b
    ), observed_days AS (
      SELECT date_trunc('day', e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day,
        count(DISTINCT e.visitor_id)::int AS visitors,
        count(DISTINCT e.session_id)::int AS sessions,
        count(DISTINCT e.page_view_id) FILTER (WHERE e.event_name = 'page_view')::int AS page_views,
        count(*) FILTER (WHERE e.event_name = 'element_click' AND e.metadata->>'destination' = 'telegram')::int AS telegram_clicks,
        count(DISTINCT e.metadata->>'conversion_id') FILTER (WHERE e.event_name = 'form_success' AND e.source = 'server')::int AS analytics_conversions
      FROM events e
      GROUP BY 1
    ), daily AS (
      SELECT c.day, COALESCE(d.visitors, 0) AS visitors, COALESCE(d.sessions, 0) AS sessions,
        COALESCE(d.page_views, 0) AS page_views, COALESCE(d.telegram_clicks, 0) AS telegram_clicks,
        COALESCE(d.analytics_conversions, 0) AS analytics_conversions
      FROM calendar c LEFT JOIN observed_days d USING (day)
    ), pages AS (
      SELECT e.path,
        count(DISTINCT e.page_view_id) FILTER (WHERE e.event_name = 'page_view')::int AS page_views,
        count(DISTINCT e.visitor_id) FILTER (WHERE e.event_name = 'page_view')::int AS unique_visitors,
        count(*) FILTER (WHERE e.event_name = 'element_click' AND e.metadata->>'destination' = 'telegram')::int AS telegram_clicks
      FROM events e
      GROUP BY e.path
      HAVING count(*) FILTER (WHERE e.event_name = 'page_view') > 0
      ORDER BY page_views DESC, e.path ASC
      LIMIT 20
    )
    SELECT b.generated_at, b.period_start,
      (SELECT max(e.received_at) FROM analytics_report_events e WHERE e.product_id = ${ANALYTICS_PRODUCT}) AS last_received_at,
      (SELECT min(e.occurred_at) FROM analytics_report_events e WHERE e.product_id = ${ANALYTICS_PRODUCT}) AS history_available_from,
      json_build_object(
        'visitors', (SELECT count(DISTINCT e.visitor_id)::int FROM events e),
        'sessions', (SELECT count(DISTINCT e.session_id)::int FROM events e),
        'page_views', (SELECT count(DISTINCT e.page_view_id)::int FROM events e WHERE e.event_name = 'page_view'),
        'telegram_clicks', (SELECT count(*)::int FROM events e WHERE e.event_name = 'element_click' AND e.metadata->>'destination' = 'telegram'),
        'analytics_conversions', (SELECT count(DISTINCT e.metadata->>'conversion_id')::int FROM events e WHERE e.event_name = 'form_success' AND e.source = 'server')
      ) AS totals,
      COALESCE((SELECT json_agg(json_build_object(
        'date', to_char(d.day AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
        'visitors', d.visitors, 'sessions', d.sessions, 'page_views', d.page_views,
        'telegram_clicks', d.telegram_clicks, 'analytics_conversions', d.analytics_conversions
      ) ORDER BY d.day) FROM daily d), '[]'::json) AS daily_series,
      COALESCE((SELECT json_agg(json_build_object(
        'path', p.path, 'page_views', p.page_views,
        'unique_visitors', p.unique_visitors, 'telegram_clicks', p.telegram_clicks
      ) ORDER BY p.page_views DESC, p.path ASC) FROM pages p), '[]'::json) AS top_pages
    FROM bounds b
  `;
  if (!row) throw new Error("analytics_report_empty");
  return analyticsOverviewSchema.parse({
    product_id: ANALYTICS_PRODUCT,
    generated_at: iso(row.generated_at)!,
    last_received_at: iso(row.last_received_at),
    history_available_from: iso(row.history_available_from),
    period_start: iso(row.period_start)!,
    days,
    totals: row.totals,
    daily_series: row.daily_series,
    top_pages: row.top_pages,
  });
}

type SessionReportOptions = {
  selection?: ReportSelection;
  days: AnalyticsReportDays;
  page: number;
  path?: string;
  eventName?: AnalyticsSessions["filters"]["event_name"];
};

export async function readSessions(sql: AnalyticsDatabase, options: SessionReportOptions): Promise<AnalyticsSessions> {
  const { days, page, path = null, eventName = null } = options;
  const offset = (page - 1) * 50;
  const [row] = await sql<ReportRow[]>`
    WITH bounds AS (
      SELECT statement_timestamp() AS generated_at,
        (date_trunc('day', statement_timestamp() AT TIME ZONE 'UTC')
          - (${days}::int - 1) * interval '1 day') AT TIME ZONE 'UTC' AS period_start
    ), candidate_sessions AS (
      SELECT DISTINCT e.session_id
      FROM analytics_report_events e, bounds b
      WHERE e.product_id = ${ANALYTICS_PRODUCT}
        AND e.occurred_at >= b.period_start
        AND e.occurred_at < b.generated_at
        AND (${path}::text IS NULL OR e.path = ${path})
        AND (${eventName}::text IS NULL OR e.event_name = ${eventName})
        AND (${selectionPredicate(sql, options.selection)})
    ), paged_sessions AS (
      SELECT e.session_id, min(e.occurred_at) AS started_at
      FROM analytics_report_events e
      JOIN candidate_sessions c ON c.session_id = e.session_id
      WHERE e.product_id = ${ANALYTICS_PRODUCT}
      GROUP BY e.session_id
      ORDER BY started_at DESC, e.session_id DESC
      LIMIT 50 OFFSET ${offset}
    ), session_events AS (
      SELECT e.*
      FROM analytics_report_events e
      JOIN paged_sessions c ON c.session_id = e.session_id
      WHERE e.product_id = ${ANALYTICS_PRODUCT}
    ), ${sessionSummaries(sql)}

    SELECT b.generated_at, b.period_start,
      (SELECT max(e.received_at) FROM analytics_report_events e WHERE e.product_id = ${ANALYTICS_PRODUCT}) AS last_received_at,
      (SELECT min(e.occurred_at) FROM analytics_report_events e WHERE e.product_id = ${ANALYTICS_PRODUCT}) AS history_available_from,
      (SELECT count(*)::int FROM candidate_sessions) AS total,
      COALESCE((SELECT json_agg(w ORDER BY w.started_at DESC, w.session_id DESC)
        FROM with_outcome w), '[]'::json) AS items
    FROM bounds b
  `;
  if (!row) throw new Error("analytics_sessions_empty");
  const total = row.total;
  if (total === undefined) throw new Error("analytics_sessions_invalid");
  return analyticsSessionsSchema.parse({
    product_id: ANALYTICS_PRODUCT,
    generated_at: iso(row.generated_at)!,
    last_received_at: iso(row.last_received_at),
    history_available_from: iso(row.history_available_from),
    period_start: iso(row.period_start)!,
    days,
    page,
    page_size: 50,
    pages: Math.max(1, Math.ceil(total / 50)),
    total,
    filters: { path, event_name: eventName, ...(options.selection ? { selection: options.selection } : {}) },
    items: row.items,
  });
}
