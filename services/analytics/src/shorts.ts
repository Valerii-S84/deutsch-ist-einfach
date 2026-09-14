import { isShortsSessionId, shortsBatchSchema } from "../../../lib/analytics/shorts-contract";
import { readAnalyticsJson } from "../../../lib/analytics/http";
import type { AnalyticsDatabase } from "./database";

export async function handleShorts(request: Request, sql: AnalyticsDatabase): Promise<Response> {
  const url = new URL(request.url);
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (url.pathname === "/internal/products/shorts-blocker-kids/events" && request.method === "POST") {
    if (url.search) return json({ error: "invalid_query" }, 400);
    const parsed = shortsBatchSchema.safeParse(await readAnalyticsJson(request));
    if (!parsed.success || parsed.data.events.some(event => Date.parse(event.occurred_at) > Date.now() + 60_000 || Date.parse(event.occurred_at) < Date.now() - 24 * 3600_000)) return json({ error: "invalid_payload" }, 400);
    const rows = parsed.data.events;
    const inserted = await sql.begin(tx => tx`INSERT INTO shorts_website_events ${tx(rows)} ON CONFLICT DO NOTHING RETURNING event_id`);
    return json({ accepted: rows.length, inserted: inserted.length });
  }
  if (url.pathname !== "/internal/products/shorts-blocker-kids/report" || request.method !== "GET") return json({ error: "NOT_FOUND" }, 404);
  const params = url.searchParams;
  const days = Number(params.get("days") ?? 7), page = Number(params.get("page") ?? 1), session = params.get("session");
  if ([...params.keys()].some(key => !["days", "page", "session"].includes(key) || params.getAll(key).length !== 1) || ![7, 30, 90].includes(days) || !Number.isSafeInteger(page) || page < 1 || page > 100_000 || (session !== null && !isShortsSessionId(session))) return json({ error: "invalid_query" }, 400);
  const report = await sql.begin("isolation level repeatable read read only", async tx => {
    const [clock] = await tx`SELECT statement_timestamp() AS now`;
    const now = new Date(clock.now), start = new Date(now.getTime() - days * 86400_000);
    const [freshness] = await tx`SELECT MIN(occurred_at) AS history_available_from, MAX(received_at) AS last_received_at FROM shorts_website_events WHERE NOT is_test`;
    const [totals] = await tx`SELECT COUNT(DISTINCT visitor_id)::int AS visitors, COUNT(DISTINCT session_id)::int AS sessions, COUNT(*) FILTER (WHERE event_name='page_view')::int AS page_views, COUNT(*) FILTER (WHERE event_name='element_click')::int AS clicks FROM shorts_website_events WHERE NOT is_test AND occurred_at >= ${start} AND occurred_at <= ${now}`;
    const pages = await tx`SELECT path, COUNT(*) FILTER (WHERE event_name='page_view')::int AS views, COUNT(*) FILTER (WHERE event_name='element_click')::int AS clicks FROM shorts_website_events WHERE NOT is_test AND occurred_at >= ${start} AND occurred_at <= ${now} GROUP BY path ORDER BY views DESC, path`;
    const elements = await tx`SELECT element_id, COUNT(*)::int AS clicks FROM shorts_website_events WHERE NOT is_test AND event_name='element_click' AND occurred_at >= ${start} AND occurred_at <= ${now} GROUP BY element_id ORDER BY clicks DESC, element_id`;
    const sources = await tx`SELECT referrer_host AS host, COUNT(DISTINCT session_id)::int AS sessions FROM shorts_website_events WHERE NOT is_test AND occurred_at >= ${start} AND occurred_at <= ${now} GROUP BY referrer_host ORDER BY sessions DESC LIMIT 100`;
    const sessions = await tx`SELECT session_id, MIN(visitor_id::text)::uuid AS visitor_id, MIN(occurred_at) AS first_at, MAX(occurred_at) AS last_at, COUNT(*) FILTER (WHERE event_name='page_view')::int AS views, COUNT(*) FILTER (WHERE event_name='element_click')::int AS clicks FROM shorts_website_events WHERE NOT is_test AND occurred_at >= ${start} AND occurred_at <= ${now} GROUP BY session_id ORDER BY last_at DESC, session_id LIMIT 50 OFFSET ${(page - 1) * 50}`;
    const events = session ? await tx`SELECT event_id,event_name,occurred_at,path,element_id,active_ms FROM shorts_website_events WHERE NOT is_test AND session_id=${session}::uuid AND occurred_at >= ${start} AND occurred_at <= ${now} ORDER BY occurred_at,sequence,received_at,event_id LIMIT 1001` : [];
    return { product_id: "shorts-blocker-kids", days, page, generated_at: now, ...freshness, totals, pages, elements, sources, sessions, selected_session: session, events: events.slice(0, 1000), events_truncated: events.length > 1000 };
  });
  return json(report);
}
