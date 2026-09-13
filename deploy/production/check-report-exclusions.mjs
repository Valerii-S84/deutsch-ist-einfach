import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const prefix = '/app/dist/services/analytics/src/';
const { openAnalyticsDatabase } = await import(prefix + 'database.js');
const { readOverview, readSessions, readSession } = await import(prefix + 'reports.js');
const { readPages, readEvents, readTraffic, readConversions } = await import(prefix + 'application-reports.js');
const sql = openAnalyticsDatabase();
try {
  const test = randomUUID(), real = randomUUID(), testSession = randomUUID();
  for (const visitor of [test, real]) {
    await sql`INSERT INTO analytics_events (product_id,event_id,event_name,schema_version,source,visitor_id,session_id,page_view_id,sequence,occurred_at,path,metadata)
      VALUES ('deutschmit',${randomUUID()},'page_view',1,'browser',${visitor},${visitor === test ? testSession : randomUUID()},${randomUUID()},1,statement_timestamp()-interval '1 second','/','{}')`;
  }
  await sql`INSERT INTO analytics_excluded_visitors (product_id,visitor_id,reason) VALUES ('deutschmit',${test},'isolated_acceptance')`;
  const overview = await readOverview(sql, 7);
  assert.equal(overview.totals.visitors, 1);
  assert.equal(overview.totals.page_views, 1);
  const sessions = await readSessions(sql, { days: 7, page: 1 });
  assert.equal(sessions.total, 1);
  const hidden = await readSession(sql, testSession);
  assert.equal(hidden.summary, null);
  for (const read of [readPages, readEvents, readTraffic, readConversions]) await read(sql, 7);
  const [raw] = await sql`SELECT count(*)::int AS total FROM analytics_events`;
  assert.equal(raw.total, 2, 'raw evidence retained');
  console.log('REPORT_EXCLUSIONS_SQL_OK raw=2 visible=1 all_reports=6');
} finally { await sql.end(); }
