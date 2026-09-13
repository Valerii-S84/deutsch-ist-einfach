import { ANALYTICS_PRODUCT, analyticsPagesSchema, analyticsEventsSchema, analyticsTrafficSchema, analyticsConversionsSchema, type ReportSelection } from "../../../lib/analytics/application-report-contract";
import type { AnalyticsReportDays } from "../../../lib/analytics/report-contract";
import type { AnalyticsDatabase } from "./database";

function reportEvents(sql: AnalyticsDatabase, days: AnalyticsReportDays) {
  return sql`bounds AS (
    SELECT statement_timestamp() AS generated_at,
      (date_trunc('day', statement_timestamp() AT TIME ZONE 'UTC') - (${days}::int - 1) * interval '1 day') AT TIME ZONE 'UTC' AS period_start
  ), events AS (
    SELECT e.* FROM analytics_report_events e, bounds b WHERE e.product_id = ${ANALYTICS_PRODUCT}
      AND e.occurred_at >= b.period_start AND e.occurred_at < b.generated_at
  )`;
}
function reportMeta(sql: AnalyticsDatabase) {
  return sql`b.generated_at, b.period_start,
    (SELECT max(received_at) FROM analytics_report_events WHERE product_id = ${ANALYTICS_PRODUCT}) AS last_received_at,
    (SELECT min(occurred_at) FROM analytics_report_events WHERE product_id = ${ANALYTICS_PRODUCT}) AS history_available_from`;
}
function envelope(row: Record<string, unknown>, days: AnalyticsReportDays) {
  // postgres returns top-level timestamptz as Date, JSON aggregates as ISO strings.
  return { ...row, product_id: ANALYTICS_PRODUCT, days,
    ...Object.fromEntries(["generated_at", "period_start", "last_received_at", "history_available_from"].map(key => [key, row[key] instanceof Date ? row[key].toISOString() : row[key]])),
  };
}

export async function readPages(sql: AnalyticsDatabase, days: AnalyticsReportDays) {
  const [row] = await sql`WITH ${reportEvents(sql, days)}, views AS (
    SELECT DISTINCT ON (page_view_id) page_view_id, path, visitor_id FROM events WHERE event_name = 'page_view'
    ORDER BY page_view_id, sequence, occurred_at, event_id
  ), measured AS (
    SELECT v.*, max((e.metadata->>'active_ms')::bigint) AS active_ms FROM views v
    LEFT JOIN analytics_report_events e ON e.product_id = ${ANALYTICS_PRODUCT} AND e.page_view_id = v.page_view_id
      AND e.event_name IN ('engagement', 'page_leave') AND e.occurred_at < (SELECT generated_at FROM bounds)
    GROUP BY v.page_view_id, v.path, v.visitor_id
  ), page_totals AS (
    SELECT path, count(*)::int AS page_views, count(DISTINCT visitor_id)::int AS visitors,
      count(active_ms)::int AS measured_views, avg(active_ms)::float8 AS average_active_ms FROM measured GROUP BY path
  ), observations AS (
    SELECT path,
      max(CASE WHEN event_name = 'scroll_depth' THEN (metadata->>'threshold')::int WHEN event_name = 'page_leave' THEN (metadata->>'scroll_percent')::int END) AS max_scroll,
      count(DISTINCT (page_view_id, metadata->>'article_id')) FILTER (WHERE event_name = 'article_read')::int AS article_reads
    FROM events GROUP BY path
  ), items AS (
    SELECT o.path, COALESCE(p.page_views, 0) AS page_views, COALESCE(p.visitors, 0) AS visitors,
      COALESCE(p.measured_views, 0) AS measured_views, p.average_active_ms, o.max_scroll, o.article_reads
    FROM observations o LEFT JOIN page_totals p USING (path)
  ) SELECT ${reportMeta(sql)}, COALESCE((SELECT json_agg(i ORDER BY page_views DESC, path) FROM items i), '[]'::json) AS items FROM bounds b`;
  return analyticsPagesSchema.parse(envelope(row, days));
}

export async function readEvents(sql: AnalyticsDatabase, days: AnalyticsReportDays) {
  const [row] = await sql`WITH ${reportEvents(sql, days)}, event_counts AS (
    SELECT event_name, count(DISTINCT CASE
      WHEN event_name = 'page_view' THEN page_view_id::text
      WHEN event_name IN ('quiz_started', 'quiz_completed') THEN metadata->>'quiz_run_id'
      WHEN event_name = 'form_success' AND source = 'server' THEN metadata->>'conversion_id'
      WHEN event_name = 'element_impression' THEN jsonb_build_array(page_view_id, metadata->>'element_id', metadata->>'placement')::text
      WHEN event_name = 'scroll_depth' THEN jsonb_build_array(page_view_id, metadata->>'threshold')::text
      WHEN event_name = 'article_read' THEN jsonb_build_array(page_view_id, metadata->>'article_id')::text
      ELSE event_id::text END)::int AS count FROM events GROUP BY event_name
  ), impressions AS (
    SELECT DISTINCT ON (page_view_id, metadata->>'element_id', metadata->>'placement')
      page_view_id, session_id, metadata->>'element_id' AS element_id, metadata->>'placement' AS placement, sequence
    FROM events WHERE event_name = 'element_impression'
    ORDER BY page_view_id, metadata->>'element_id', metadata->>'placement', sequence, occurred_at, event_id
  ), clicks AS (
    SELECT e.*, EXISTS (SELECT 1 FROM impressions i WHERE i.page_view_id = e.page_view_id AND i.session_id = e.session_id
      AND i.element_id = e.metadata->>'element_id' AND i.placement = e.metadata->>'placement' AND i.sequence < e.sequence) AS matched
    FROM events e WHERE e.event_name = 'element_click'
  ), element_keys AS (
    SELECT metadata->>'element_id' AS element_id, metadata->>'placement' AS placement FROM events
    WHERE event_name IN ('element_impression', 'element_click') GROUP BY 1, 2
  ), elements AS (
    SELECT k.*,
      (SELECT count(*)::int FROM impressions i WHERE i.element_id = k.element_id AND i.placement = k.placement) AS impressions,
      (SELECT count(*)::int FROM clicks c WHERE c.metadata->>'element_id' = k.element_id AND c.metadata->>'placement' = k.placement) AS clicks,
      (SELECT count(DISTINCT c.page_view_id)::int FROM clicks c WHERE c.metadata->>'element_id' = k.element_id AND c.metadata->>'placement' = k.placement AND c.matched) AS matched_click_views,
      (SELECT count(*)::int FROM clicks c WHERE c.metadata->>'element_id' = k.element_id AND c.metadata->>'placement' = k.placement AND NOT c.matched) AS unmatched_clicks
    FROM element_keys k
  ), errors AS (
    SELECT metadata->>'error_code' AS error_code, metadata->>'component_id' AS component_id, count(*)::int AS count
    FROM events WHERE event_name = 'frontend_error' GROUP BY 1, 2
  ) SELECT ${reportMeta(sql)},
    COALESCE((SELECT json_agg(c ORDER BY event_name) FROM event_counts c), '[]'::json) AS events,
    COALESCE((SELECT json_agg(e ORDER BY element_id, placement) FROM elements e), '[]'::json) AS elements,
    COALESCE((SELECT json_agg(e ORDER BY error_code, component_id) FROM errors e), '[]'::json) AS errors FROM bounds b`;
  return analyticsEventsSchema.parse(envelope(row, days));
}

export function sessionEntries(sql: AnalyticsDatabase) {
  return sql`SELECT DISTINCT ON (session_id) session_id, metadata FROM analytics_report_events
    WHERE product_id = ${ANALYTICS_PRODUCT}
    ORDER BY session_id, sequence NULLS LAST, occurred_at, event_id`;
}

export async function readTraffic(sql: AnalyticsDatabase, days: AnalyticsReportDays) {
  const [row] = await sql`WITH ${reportEvents(sql, days)}, entries AS (${sessionEntries(sql)}), per_session AS (
    SELECT e.session_id, count(DISTINCT e.metadata->>'conversion_id') FILTER (WHERE e.event_name = 'form_success' AND e.source = 'server')::int AS conversions
    FROM events e GROUP BY e.session_id
  ), attributed AS (
    SELECT s.*, entry.metadata->>'referrer_host' AS referrer_host, entry.metadata->>'utm_source' AS utm_source,
      entry.metadata->>'utm_medium' AS utm_medium, entry.metadata->>'utm_campaign' AS utm_campaign
    FROM per_session s JOIN entries entry USING (session_id)
  ), items AS (
    SELECT referrer_host, utm_source, utm_medium, utm_campaign,
      CASE WHEN 'unknown' IN (referrer_host, utm_source, utm_medium, utm_campaign) THEN 'unknown'
        WHEN COALESCE(referrer_host, utm_source, utm_medium, utm_campaign) IS NULL THEN 'direct' ELSE 'attributed' END AS source_kind,
      count(DISTINCT a.session_id)::int AS sessions,
      count(DISTINCT a.session_id) FILTER (WHERE conversions > 0)::int AS converted_sessions,
      count(DISTINCT e.metadata->>'conversion_id') FILTER (WHERE e.event_name = 'form_success' AND e.source = 'server')::int AS analytics_conversions
    FROM attributed a JOIN events e USING (session_id) GROUP BY referrer_host, utm_source, utm_medium, utm_campaign
  ) SELECT ${reportMeta(sql)}, COALESCE((SELECT json_agg(i ORDER BY sessions DESC, source_kind, referrer_host, utm_source, utm_medium, utm_campaign) FROM items i), '[]'::json) AS items FROM bounds b`;
  return analyticsTrafficSchema.parse(envelope(row, days));
}

export async function readConversions(sql: AnalyticsDatabase, days: AnalyticsReportDays) {
  const [row] = await sql`WITH ${reportEvents(sql, days)}, forms AS (
    SELECT f.form_id, count(*) FILTER (WHERE e.event_name = 'form_open')::int AS opens,
      count(*) FILTER (WHERE e.event_name = 'form_submit')::int AS submits,
      count(DISTINCT e.metadata->>'conversion_id') FILTER (WHERE e.event_name = 'form_success' AND e.source = 'server')::int AS successes,
      count(*) FILTER (WHERE e.event_name = 'form_error')::int AS errors
    FROM (VALUES ('student'), ('partner')) f(form_id) LEFT JOIN events e ON e.metadata->>'form_id' = f.form_id GROUP BY f.form_id
  ), quizzes AS (
    SELECT metadata->>'quiz_id' AS quiz_id,
      count(DISTINCT metadata->>'quiz_run_id') FILTER (WHERE event_name = 'quiz_started')::int AS starts,
      count(DISTINCT metadata->>'quiz_run_id') FILTER (WHERE event_name = 'quiz_completed')::int AS completions
    FROM events WHERE event_name IN ('quiz_started', 'quiz_completed') GROUP BY 1
  ), intents AS (
    SELECT d.destination, count(e.event_id)::int AS clicks FROM (VALUES ('telegram'), ('youtube'), ('amazon'), ('download')) d(destination)
    LEFT JOIN events e ON e.event_name = 'element_click' AND e.metadata->>'destination' = d.destination GROUP BY d.destination
  ) SELECT ${reportMeta(sql)},
    (SELECT json_agg(f ORDER BY form_id) FROM forms f) AS forms,
    COALESCE((SELECT json_agg(q ORDER BY quiz_id) FROM quizzes q), '[]'::json) AS quizzes,
    (SELECT json_agg(i ORDER BY destination) FROM intents i) AS intents FROM bounds b`;
  return analyticsConversionsSchema.parse(envelope(row, days));
}

// Only strict, known selectors become parameterized predicates on an in-window event.
export function selectionPredicate(sql: AnalyticsDatabase, selection?: ReportSelection) {
  if (!selection) return sql`true`;
  switch (selection.kind) {
    case 'page': return sql`e.path = ${selection.path}`;
    case 'event': return sql`e.event_name = ${selection.event_name}`;
    case 'element': return sql`e.event_name IN ('element_impression', 'element_click') AND e.metadata->>'element_id' = ${selection.element_id} AND e.metadata->>'placement' = ${selection.placement}`;
    case 'error': return sql`e.event_name = 'frontend_error' AND e.metadata->>'error_code' = ${selection.error_code} AND e.metadata->>'component_id' = ${selection.component_id}`;
    case 'form': return sql`e.event_name = ${selection.event_name} AND e.metadata->>'form_id' = ${selection.form_id}`;
    case 'quiz': return sql`e.event_name = ${selection.event_name} AND e.metadata->>'quiz_id' = ${selection.quiz_id}`;
    case 'intent': return sql`e.event_name = 'element_click' AND e.metadata->>'destination' = ${selection.destination}`;
    case 'traffic': return sql`e.session_id IN (SELECT entry.session_id FROM (${sessionEntries(sql)}) entry WHERE
      entry.metadata->>'referrer_host' IS NOT DISTINCT FROM ${selection.referrer_host}::text AND
      entry.metadata->>'utm_source' IS NOT DISTINCT FROM ${selection.utm_source}::text AND
      entry.metadata->>'utm_medium' IS NOT DISTINCT FROM ${selection.utm_medium}::text AND
      entry.metadata->>'utm_campaign' IS NOT DISTINCT FROM ${selection.utm_campaign}::text)`;
  }
}
