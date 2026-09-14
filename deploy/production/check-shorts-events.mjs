import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const { openAnalyticsDatabase } = await import('/app/dist/services/analytics/src/database.js');
const { createAnalyticsHandler } = await import('/app/dist/services/analytics/src/app.js');
const sql = openAnalyticsDatabase();
const key = 'synthetic-shorts-acceptance-key-000001';
const handle = createAnalyticsHandler(sql, key);
const session = randomUUID(), visitor = randomUUID(), view = randomUUID();
const base = { visitor_id: visitor, session_id: session, page_view_id: view, occurred_at: new Date(Date.now() - 1000).toISOString(), sequence: 1, path: '/', element_id: null, active_ms: null, referrer_host: 'example.org', device: 'desktop', is_test: false };
const make = (values) => ({ ...base, event_id: randomUUID(), ...values });
const events = [make({ event_name: 'page_view' }), make({ event_name: 'element_click', sequence: 2, element_id: 'support' }), make({ event_name: 'page_leave', sequence: 3, active_ms: 1500 }), make({ event_name: 'page_view', page_view_id: randomUUID(), visitor_id: randomUUID(), session_id: randomUUID(), is_test: true })];
const request = (path, body, auth = true) => new Request('http://analytics/internal/products/shorts-blocker-kids/' + path, { method: body ? 'POST' : 'GET', headers: { ...(auth ? { Authorization: 'Bearer ' + key } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
try {
  assert.equal((await handle(request('report?days=7', undefined, false))).status, 401);
  for (let repeat = 0; repeat < 2; repeat++) {
    const response = await handle(request('events', { events }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).inserted, repeat ? 0 : 4);
  }
  const response = await handle(request('report?days=7&session=' + session));
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.deepEqual(report.totals, { visitors: 1, sessions: 1, page_views: 1, clicks: 1 });
  assert.equal(report.events.length, 3);
  assert.equal(report.sources[0].host, 'example.org');
  assert.equal(report.elements[0].element_id, 'support');
  assert.equal((await handle(request('report?days=7&session=invalid'))).status, 400);
  const rejected = await handle(request('events', { events: [{ ...events[0], event_id: randomUUID(), email: 'private@example.org' }] }));
  assert.equal(rejected.status, 400);
  console.log('SHORTS_DATABASE_OK deduplication=true isolated=true test_exclusion=true detail_events=3');
} finally { await sql.end(); }
