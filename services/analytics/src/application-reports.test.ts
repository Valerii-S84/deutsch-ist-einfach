// @vitest-environment node
// Only a disposable local PostgreSQL on the dedicated step-6 test port.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { openAnalyticsDatabase, insertEvents, type AnalyticsDatabase } from "./database";
import { readPages, readEvents, readTraffic, readConversions } from "./application-reports";
import { readOverview, readSessions } from "./reports";
import { createAnalyticsHandler } from "./app";
import { syntheticEvent } from "../../../lib/analytics/fixtures.test-support";
import type { AnalyticsEvent } from "../../../lib/analytics/contract";
import type { ReportSelection } from "../../../lib/analytics/report-selection";

describe.skipIf(process.env.ANALYTICS_STEP6_POSTGRES_TEST !== '1')('application report SQL on disposable PostgreSQL', () => {
const schema = `step6_${randomUUID().replaceAll('-', '')}`;
const useV1Stand = process.env.ANALYTICS_STEP6_USE_V1_STAND === '1';
const sql = openAnalyticsDatabase(`postgresql://analytics_user:${useV1Stand ? 'synthetic-analytics-only@127.0.0.1:45442' : 'synthetic-step6-only@127.0.0.1:45446'}/deutschmit_analytics?search_path=${schema}`);
const a = randomUUID(), b = randomUUID(), a1 = randomUUID(), a2 = randomUUID(), b1 = randomUUID();
const views = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const sequences = new Map<string, number>();
const yesterday = new Date(); yesterday.setUTCHours(12, 0, 0, 0); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
function event(name: AnalyticsEvent['event_name'], session = a1, view = views[0], path = '/', metadata: Record<string, unknown> = {}, visitor = a): AnalyticsEvent {
  const sequence = (sequences.get(session) ?? 0) + 1; sequences.set(session, sequence);
  const base = syntheticEvent(name, yesterday.getTime() + sequence);
  return { ...base, event_id: randomUUID(), session_id: session, visitor_id: visitor, page_view_id: view, path,
    sequence: name === 'form_success' ? null : sequence, metadata: { ...base.metadata, ...metadata } } as AnalyticsEvent;
}
async function insert(rows: AnalyticsEvent[]) {
  for (const source of ['browser', 'server'] as const) {
    const selected = rows.filter(row => (row.event_name === 'form_success') === (source === 'server'));
    if (selected.length) await insertEvents(sql, selected, source);
  }
}
beforeAll(async () => {
  await sql`CREATE SCHEMA ${sql(schema)}`;
  await sql.unsafe(readFileSync('services/analytics/db/migrations/0001_create_analytics_events.sql', 'utf8'));
});
afterAll(async () => { await sql`DROP SCHEMA ${sql(schema)} CASCADE`; await sql.end(); });
beforeEach(async () => {
  await sql`TRUNCATE analytics_events`; sequences.clear();
  const campaign = { utm_campaign: 'test' };
  const article = '/artikel/deutsche-sprache-geschichte';
  const rows = [event('session_start'), event('page_view'), event('page_view', a1, views[1], '/wissen'),
    event('engagement', a1, views[1], '/wissen', { active_ms: 30000 }), event('engagement', a1, views[1], '/wissen', { active_ms: 60000 }),
    event('element_impression', a1, views[1], '/wissen'), event('element_click', a1, views[1], '/wissen'),
    ...(['session_start', 'page_view', 'form_open', 'form_submit', 'form_success', 'form_submit'] as const).map(name => event(name, a2, views[2], '/contact', campaign)),
    ...(['session_start', 'page_view', 'scroll_depth', 'engagement', 'article_read', 'quiz_started', 'quiz_completed', 'element_impression'] as const).map(name => event(name, b1, views[3], article, name === 'element_impression' ? { element_id: 'second_cta' } : {}, b)),
  ];
  await insert(rows);
  await insert(rows.filter(row => ['element_click', 'quiz_completed', 'form_success'].includes(row.event_name)));
  await insert(rows.filter(row => ['page_view', 'quiz_completed', 'form_success', 'article_read', 'element_impression', 'scroll_depth'].includes(row.event_name)).map(row => ({ ...row, event_id: randomUUID() })));
});

it.each([7, 30, 90] as const)('section 6 control and semantic duplicates at %i UTC days', async days => {
  expect((await readOverview(sql, days)).totals).toEqual({ visitors: 2, sessions: 3, page_views: 4, telegram_clicks: 1, analytics_conversions: 1 });
  const pages = await readPages(sql, days);
  expect(pages.items.find(row => row.path === '/wissen')).toMatchObject({ page_views: 1, visitors: 1, measured_views: 1, average_active_ms: 60000, max_scroll: null });
  expect(pages.items.find(row => row.path === '/')).toMatchObject({ measured_views: 0, average_active_ms: null });
  expect(pages.items.find(row => row.path.startsWith('/artikel'))).toMatchObject({ article_reads: 1, max_scroll: 90, average_active_ms: 60000 });
  const events = await readEvents(sql, days);
  expect(events.elements.find(row => row.element_id === 'telegram_cta')).toMatchObject({ impressions: 1, clicks: 1, matched_click_views: 1, unmatched_clicks: 0 });
  expect(events.elements.find(row => row.element_id === 'second_cta')).toMatchObject({ impressions: 1, clicks: 0, matched_click_views: 0 });
  expect(events.events.find(row => row.event_name === 'article_read')?.count).toBe(1);
  const traffic = await readTraffic(sql, days);
  expect(traffic.items.find(row => row.source_kind === 'direct')).toMatchObject({ sessions: 2, converted_sessions: 0, analytics_conversions: 0 });
  expect(traffic.items.find(row => row.utm_campaign === 'test')).toMatchObject({ sessions: 1, converted_sessions: 1, analytics_conversions: 1 });
  const conversions = await readConversions(sql, days);
  expect(conversions.forms.find(row => row.form_id === 'student')).toMatchObject({ opens: 1, submits: 2, successes: 1, errors: 0 });
  expect(conversions.quizzes).toEqual([{ quiz_id: 'daily', starts: 1, completions: 1 }]);
  expect(conversions.intents.find(row => row.destination === 'telegram')?.clicks).toBe(1);
  for (const report of [pages, events, traffic, conversions]) {
    expect(report.days).toBe(days); expect(report.history_available_from).not.toBeNull(); expect(report.last_received_at).not.toBeNull();
    const expected = new Date(report.generated_at); expected.setUTCHours(0, 0, 0, 0); expected.setUTCDate(expected.getUTCDate() - days + 1);
    expect(report.period_start).toBe(expected.toISOString());
  }
});

it('keeps real repeats, before-impression/orphan/other-placement clicks and frontend codes separate', async () => {
  const before = event('element_click', a1, views[1], '/wissen', { element_id: 'late' });
  const impression = event('element_impression', a1, views[1], '/wissen', { element_id: 'late' });
  await insert([event('element_click', a1, views[1], '/wissen'), before, impression,
    event('element_click', a1, views[1], '/wissen', { placement: 'footer', destination: 'youtube' }),
    event('frontend_error', a1, views[1], '/wissen'), event('form_error', a2, views[2], '/contact'),
    event('element_click', a1, views[1], '/wissen', { element_id: 'amazon', destination: 'amazon' }),
    event('element_click', a1, views[1], '/wissen', { element_id: 'download', destination: 'download' }),
  ]);
  const report = await readEvents(sql, 7);
  expect(report.elements.find(row => row.element_id === 'telegram_cta' && row.placement === 'hero')).toMatchObject({ clicks: 2, matched_click_views: 1 });
  expect(report.elements.find(row => row.element_id === 'late')).toMatchObject({ impressions: 1, clicks: 1, matched_click_views: 0, unmatched_clicks: 1 });
  expect(report.elements.find(row => row.placement === 'footer')).toMatchObject({ impressions: 0, clicks: 1, matched_click_views: 0, unmatched_clicks: 1 });
  expect(report.errors).toEqual([{ error_code: 'unknown_error', component_id: 'app', count: 1 }]);
  const conversions = await readConversions(sql, 7);
  expect(conversions.forms.find(row => row.form_id === 'partner')?.errors).toBe(1);
  for (const destination of ['youtube', 'amazon', 'download']) expect(conversions.intents.find(row => row.destination === destination)?.clicks).toBe(1);
});

it('honors UTC boundary, view-start active-time cohort and in-window CTR on both sides', async () => {
  const { period_start } = await readPages(sql, 7); const boundary = Date.parse(period_start);
  const oldView = randomUUID(), newView = randomUUID();
  await insert([
    { ...event('page_view', a1, oldView, '/wissen'), occurred_at: new Date(boundary - 1).toISOString() },
    event('engagement', a1, oldView, '/wissen', { active_ms: 90000 }),
    { ...event('page_view', a1, newView, '/wissen'), occurred_at: period_start },
    event('page_leave', a1, newView, '/wissen', { active_ms: 0 }),
    { ...event('element_impression', a1, newView, '/wissen', { element_id: 'boundary' }), occurred_at: new Date(boundary - 1).toISOString() },
    event('element_click', a1, newView, '/wissen', { element_id: 'boundary' }),
    { ...event('page_view', a1, randomUUID(), '/wissen'), occurred_at: new Date(Date.now() + 3600000).toISOString() },
  ]);
  expect((await readPages(sql, 7)).items.find(row => row.path === '/wissen')).toMatchObject({ page_views: 2, measured_views: 2, average_active_ms: 30000 });
  expect((await readPages(sql, 30)).items.find(row => row.path === '/wissen')).toMatchObject({ page_views: 3, measured_views: 3, average_active_ms: 50000 });
  expect((await readEvents(sql, 7)).elements.find(row => row.element_id === 'boundary')).toMatchObject({ impressions: 0, unmatched_clicks: 1 });
  expect((await readEvents(sql, 30)).elements.find(row => row.element_id === 'boundary')).toMatchObject({ impressions: 1, matched_click_views: 1 });
});

it('retains entry attribution across the window and missing start, separating direct and unknown', async () => {
  await sql`UPDATE analytics_events SET occurred_at = occurred_at - interval '10 days' WHERE session_id = ${a2} AND event_name = 'session_start'`;
  await insert([event('page_view', a2, randomUUID(), '/wissen', { utm_campaign: 'internal-change' }), event('page_view', randomUUID(), randomUUID(), '/', { utm_source: 'unknown' })]);
  const report = await readTraffic(sql, 7);
  expect(report.items.find(row => row.utm_campaign === 'test')).toMatchObject({ sessions: 1, converted_sessions: 1 });
  expect(report.items.find(row => row.utm_campaign === 'internal-change')).toBeUndefined();
  expect(report.items.find(row => row.source_kind === 'unknown')?.sessions).toBe(1);
  expect(report.items.find(row => row.source_kind === 'direct')?.sessions).toBe(2);
  await insert([event('form_success', a1, views[0]), event('form_success', b1, views[3])]);
  expect((await readTraffic(sql, 7)).items.find(row => row.source_kind === 'direct')).toMatchObject({ sessions: 2, converted_sessions: 2, analytics_conversions: 1 });
});

it('every report selector returns exactly corresponding sessions and preserves period', async () => {
  const cases: [ReportSelection, string[]][] = [
    [{ kind: 'page', path: '/wissen' }, [a1]], [{ kind: 'event', event_name: 'article_read' }, [b1]],
    [{ kind: 'element', element_id: 'second_cta', placement: 'hero' }, [b1]],
    [{ kind: 'error', error_code: 'unknown_error', component_id: 'app' }, []],
    [{ kind: 'traffic', referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: 'test' }, [a2]],
    [{ kind: 'traffic', referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null }, [a1, b1]],
    [{ kind: 'form', form_id: 'student', event_name: 'form_success' }, [a2]],
    [{ kind: 'quiz', quiz_id: 'daily', event_name: 'quiz_completed' }, [b1]], [{ kind: 'intent', destination: 'telegram' }, [a1]],
  ];
  for (const [selection, expected] of cases) {
    const report = await readSessions(sql, { days: 7, page: 1, selection });
    expect(report.items.map(row => row.session_id).sort()).toEqual(expected.sort());
    expect(report.filters.selection).toEqual(selection); expect(report.days).toBe(7);
    expect(report.items.every(row => row.status === 'timed_out')).toBe(true);
  }
});

it('paginates selected IDs by full-history start while preserving total and complete summaries', async () => {
  await sql`TRUNCATE analytics_events`;
  await sql`INSERT INTO analytics_events(product_id,event_id,event_name,schema_version,source,visitor_id,session_id,page_view_id,sequence,occurred_at,path,metadata)
    SELECT 'deutschmit',gen_random_uuid(),CASE step WHEN 1 THEN 'session_start' ELSE 'page_view' END,1,'browser',
      md5('visitor-pagination-'||n)::uuid,md5('session-pagination-'||n)::uuid,md5('view-pagination-'||n)::uuid,step,
      CASE step WHEN 1 THEN statement_timestamp()-interval '92 days'+n*interval '1 second'
        ELSE statement_timestamp()-interval '1 hour'-n*interval '1 second' END,'/wissen','{}'::jsonb
    FROM generate_series(1,51) n CROSS JOIN generate_series(1,2) step`;
  const expected = await sql`SELECT md5('session-pagination-'||n)::uuid AS id FROM generate_series(1,51) n ORDER BY n DESC`;
  const first = await readSessions(sql, { days: 7, page: 1 });
  const second = await readSessions(sql, { days: 7, page: 2 });
  const beyond = await readSessions(sql, { days: 7, page: 3 });
  for (const report of [first, second, beyond]) { expect(report.total).toBe(51); expect(report.pages).toBe(2); }
  expect(first.items.map(row => row.session_id)).toEqual(expected.slice(0,50).map(row => row.id));
  expect(second.items.map(row => row.session_id)).toEqual(expected.slice(50).map(row => row.id));
  expect(beyond.items).toEqual([]);
  expect([...first.items, ...second.items].every(row => row.event_count === 2 && row.page_views === 1)).toBe(true);
  expect((await readSessions(sql, { days: 7, page: 1, path: '/missing' })).total).toBe(0);
});

it('explicit internal endpoints protect access, validate queries and distinguish empty period/source/unavailable', async () => {
  const key = 'synthetic-step6-key-at-least-32-characters';
  const handler = createAnalyticsHandler(sql, key);
  const broken = createAnalyticsHandler((() => { throw new Error('database unavailable'); }) as unknown as AnalyticsDatabase, key);
  for (const name of ['pages', 'events', 'traffic', 'conversions']) {
    const url = `http://localhost/internal/products/deutschmit/${name}`;
    expect((await handler(new Request(url))).status).toBe(401);
    const headers = { authorization: `Bearer ${key}` };
    for (const query of ['?days=14', '?days=7&days=30', '?product=quiz-arena']) expect((await handler(new Request(url + query, { headers }))).status).toBe(400);
    const response = await handler(new Request(url + '?days=7', { headers }));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await broken(new Request(url, { headers }))).status).toBe(503);
  }
  await sql`UPDATE analytics_events SET occurred_at = occurred_at - interval '40 days'`;
  const emptyPeriod = await readPages(sql, 7); expect(emptyPeriod.items).toEqual([]); expect(emptyPeriod.history_available_from).not.toBeNull();
  await sql`TRUNCATE analytics_events`;
  for (const read of [readPages, readEvents, readTraffic, readConversions]) expect((await read(sql, 7)).history_available_from).toBeNull();
});
});
