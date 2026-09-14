import postgres from "postgres";
import { ANALYTICS_PRODUCT, analyticsId, type AnalyticsEvent, type EventSource } from "../../../lib/analytics/contract";

export function openAnalyticsDatabase(databaseUrl = process.env.ANALYTICS_DATABASE_URL) {
  if (!databaseUrl) throw new Error("analytics_database_not_configured");
  const url = new URL(databaseUrl);
  // This service and its maintenance commands must never target the site or bot DB.
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/deutschmit_analytics" || url.username !== "analytics_user") throw new Error("invalid_analytics_database_target");
  return postgres(databaseUrl, { max: 5, connect_timeout: 2, idle_timeout: 20, connection: { application_name: "deutschmit-analytics", statement_timeout: 3000, lock_timeout: 2000 }, onnotice: () => {} });
}
export type AnalyticsDatabase = ReturnType<typeof openAnalyticsDatabase>;

export async function insertEvents(sql: AnalyticsDatabase, events: AnalyticsEvent[], source: EventSource) {
  const rows = events.map(event => ({ ...event, source, metadata: sql.json(event.metadata) }));
  const inserted = await sql.begin(tx => tx`
    INSERT INTO analytics_events ${tx(rows, "product_id", "event_id", "event_name", "schema_version", "source", "visitor_id", "session_id", "page_view_id", "sequence", "occurred_at", "path", "metadata")}
    ON CONFLICT (product_id, event_id) DO NOTHING RETURNING event_id
  `);
  // sql.begin resolves only after COMMIT. No successful response before this point.
  return { accepted: events.length, inserted: inserted.length, duplicates: events.length - inserted.length };
}

export async function cleanRetention(sql: AnalyticsDatabase) {
  const shorts = await sql`DELETE FROM shorts_website_events WHERE occurred_at < statement_timestamp() - interval '90 days' OR (is_test AND received_at < statement_timestamp() - interval '1 day')`;
  const result = await sql`DELETE FROM analytics_events WHERE product_id = ${ANALYTICS_PRODUCT} AND occurred_at < statement_timestamp() - interval '90 days'`;
  return { deleted: result.count + shorts.count };
}
export async function deleteVisitor(sql: AnalyticsDatabase, productId: string, visitorId: string) {
  if (productId !== ANALYTICS_PRODUCT) throw new Error("invalid_product");
  const id = analyticsId.parse(visitorId);
  const result = await sql`DELETE FROM analytics_events WHERE product_id = ${productId} AND visitor_id = ${id}::uuid`;
  return { deleted: result.count };
}
