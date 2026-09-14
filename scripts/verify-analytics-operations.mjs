// Step 7: disposable schemas in the explicit synthetic DB; no public-schema writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cpus, totalmem, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import postgres from "postgres";
import reports from "../services/analytics/dist/services/analytics/src/reports.js";
import maintenance from "../services/analytics/dist/services/analytics/src/database.js";
import migrations from "../services/analytics/dist/services/analytics/src/migrate.js";

const output = ".verification/website-analytics/v1";
mkdirSync(`${output}/ops-private`, { recursive: true });
const schema = `step7_${randomUUID().replaceAll('-', '')}`;
const sql = postgres("postgresql://analytics_user:synthetic-analytics-only@127.0.0.1:45442/deutschmit_analytics", { connection: { search_path: schema, statement_timeout: 3000 }, onnotice: () => {}, connect_timeout: 3 });
const dump = `/tmp/${schema}.dump`, container = "website-analytics-acceptance-analytics-db-1";
const results = [], environment = { platform: platform(), release: release(), node: process.version, cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Math.round(totalmem()/2**30) };
function docker(args) {
  const result = spawnSync("docker", ["--config", resolve('.docker-test-config'), ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, `Synthetic Docker operation failed (${result.error?.code ?? result.status})`);
  return result.stdout;
}
async function check(name, fn) {
  try { const evidence = await fn(); results.push({ name, status: 'PASS', evidence }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.code ?? error.message }); console.log(`FAIL: ${name}: ${error.code ?? error.message}`); process.exitCode = 1; }
  finally { writeFileSync(`${output}/operations.json`, JSON.stringify({ generated_at: new Date().toISOString(), environment, results }, null, 2)); }
}
try {
  await sql`CREATE SCHEMA ${sql(schema)}`;
  await migrations.migrate(sql, resolve('services/analytics/db/migrations'));
  environment.postgres = (await sql`SELECT version() AS version`)[0].version;
  const publicBefore = (await sql`SELECT count(*)::int AS count FROM public.analytics_events`)[0].count;
  if (!process.argv.includes('--performance-only')) await check('backup restore stays quarantined until retention and deletion journal are replayed', async () => {
    const removed = randomUUID(), kept = randomUUID();
    await sql`INSERT INTO analytics_events (product_id,event_id,event_name,schema_version,source,visitor_id,session_id,page_view_id,sequence,occurred_at,path,metadata)
      SELECT 'deutschmit',gen_random_uuid(),'page_view',1,'browser',v.visitor,gen_random_uuid(),gen_random_uuid(),1,statement_timestamp()-v.age,'/','{}'::jsonb
      FROM (VALUES (${removed}::uuid,interval '1 day'),(${kept}::uuid,interval '91 days'),(${kept}::uuid,interval '1 day')) v(visitor,age)`;
    await sql`INSERT INTO shorts_website_events (event_id,visitor_id,session_id,page_view_id,event_name,occurred_at,received_at,sequence,path,device,is_test)
      SELECT gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'page_view',statement_timestamp()-v.age,statement_timestamp()-v.received_age,1,'/','desktop',v.is_test
      FROM (VALUES (interval '91 days',interval '91 days',false),(interval '1 day',interval '1 day',false),(interval '2 days',interval '2 days',true),(interval '1 hour',interval '1 hour',true)) v(age,received_age,is_test)`;
    docker(['exec',container,'pg_dump','-U','analytics_user','-d','deutschmit_analytics','-n',schema,'-Fc','--no-owner','--no-privileges','-f',dump]);
    const journal = `${output}/ops-private/${schema}-deletions.jsonl`;
    appendFileSync(journal, JSON.stringify({ product_id: 'deutschmit', visitor_id: removed, requested_at: new Date().toISOString() })+'\n', { mode: 0o600 });
    assert.equal((await maintenance.cleanRetention(sql)).deleted, 3, 'one deutschmit row plus two Shorts rows');
    assert.equal((await maintenance.deleteVisitor(sql, 'deutschmit', removed)).deleted, 1);
    await sql`DROP SCHEMA ${sql(schema)} CASCADE`;
    docker(['exec',container,'pg_restore','-U','analytics_user','-d','deutschmit_analytics','--no-owner','--no-privileges',dump]);
    assert.equal((await sql`SELECT count(*)::int AS count FROM analytics_events`)[0].count, 3);
    assert.equal((await sql`SELECT count(*)::int AS count FROM shorts_website_events`)[0].count, 4);
    // This schema is never served by the running service: replay happens before exposure.
    assert.equal((await maintenance.cleanRetention(sql)).deleted, 3, 'retention replay includes both products');
    for (const line of readFileSync(journal,'utf8').trim().split('\n')) {
      const deletion = JSON.parse(line); assert.equal(deletion.product_id,'deutschmit');
      await maintenance.deleteVisitor(sql,deletion.product_id,deletion.visitor_id);
    }
    const remaining = await sql`SELECT visitor_id FROM analytics_events`;
    assert.deepEqual(remaining.map(row=>row.visitor_id),[kept]);
    assert.deepEqual((await sql`SELECT is_test FROM shorts_website_events ORDER BY is_test`).map(row=>row.is_test),[false,true]);
    await sql`INSERT INTO shorts_website_events (event_id,visitor_id,session_id,page_view_id,event_name,occurred_at,sequence,path,device)
      VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'page_view',statement_timestamp()-interval '91 days',1,'/','desktop')`;
    assert.equal((await maintenance.cleanRetention(sql)).deleted, 1, 'Shorts-only deletion must not report zero');
    assert.equal((await maintenance.cleanRetention(sql)).deleted, 0, 'repeated cleanup is idempotent');
    assert.equal((await sql`SELECT count(*)::int AS count FROM public.analytics_events`)[0].count,publicBefore);
    docker(['exec',container,'rm','--',dump]);
    return { backupRows: 7, restoredQuarantinedRows: 7, releasedRows: 3, expiredRemoved: 3, shortsOnlyDeleted: 1, deletionReapplied: 1, publicRowsUnchanged: true, journal };
  });
  if (!process.argv.includes('--performance-only') && !process.argv.includes('--retry-failed')) await check('reversed delivery and clock skew retain sequence; timeout does not add active time', async () => {
    await sql`TRUNCATE analytics_events`;
    const session=randomUUID(), visitor=randomUUID(), view=randomUUID();
    for(const sequence of [3,2,1]) await sql`INSERT INTO analytics_events(product_id,event_id,event_name,schema_version,source,visitor_id,session_id,page_view_id,sequence,occurred_at,path,metadata)
      VALUES('deutschmit',gen_random_uuid(),${sequence===1?'session_start':sequence===2?'page_view':'engagement'},1,'browser',${visitor},${session},${view},${sequence},statement_timestamp()-interval '31 minutes'-${sequence}*interval '1 second','/wissen',${sql.json(sequence===3?{active_ms:30000}:sequence===1?{entry_path:'/wissen'}:{})})`;
    const result=await reports.readSession(sql,session);
    assert.deepEqual(result.events.map(row=>row.sequence),[1,2,3]); assert.equal(result.summary.active_ms,30000); assert.equal(result.summary.status,'timed_out');
    return {browserSequences:[1,2,3],activeMs:30000,status:'timed_out'};
  });
  await check('100000 events: warm 90-day Overview and Sessions each at most 1000 ms', async () => {
    await sql`TRUNCATE analytics_events`;
    // Bulk fixture creation is not a report latency measurement.
    await sql`SET statement_timeout = 30000`;
    await sql`INSERT INTO analytics_events (product_id,event_id,event_name,schema_version,source,visitor_id,session_id,page_view_id,sequence,occurred_at,path,metadata)
      SELECT 'deutschmit', md5('event'||n)::uuid,
        CASE step WHEN 1 THEN 'session_start' WHEN 2 THEN 'page_view' WHEN 3 THEN 'engagement' WHEN 4 THEN 'element_impression' WHEN 5 THEN 'element_click' WHEN 6 THEN 'page_view' WHEN 7 THEN 'engagement' WHEN 8 THEN 'scroll_depth' WHEN 9 THEN 'engagement' ELSE 'page_leave' END,
        1,'browser',md5('visitor'||((n-1)/20))::uuid,md5('session'||((n-1)/10))::uuid,md5('view'||((n-1)/5))::uuid,step,
        statement_timestamp()-interval '1 hour'-(((n-1)/10)%89)*interval '1 day'+step*interval '1 millisecond','/wissen',
        CASE step WHEN 1 THEN '{"entry_path":"/wissen"}'::jsonb WHEN 3 THEN '{"active_ms":30000}'::jsonb
          WHEN 4 THEN '{"element_id":"cta","placement":"main"}'::jsonb WHEN 5 THEN '{"element_id":"cta","placement":"main","destination":"telegram"}'::jsonb
          WHEN 7 THEN '{"active_ms":30000}'::jsonb WHEN 8 THEN '{"threshold":90}'::jsonb WHEN 9 THEN '{"active_ms":60000}'::jsonb
          WHEN 10 THEN '{"reason":"pagehide","active_ms":60000,"scroll_percent":90}'::jsonb ELSE '{}'::jsonb END
      FROM (SELECT n,((n-1)%10)+1 AS step FROM generate_series(1,100000) n) seeded`;
    await sql`ANALYZE analytics_events`;
    await sql`SET statement_timeout = 3000`;
    assert.equal((await sql`SELECT count(*)::int AS count FROM analytics_events`)[0].count,100000);
    const measurements = {};
    for (const [name, read] of [['overview',()=>reports.readOverview(sql,90)],['sessions',()=>reports.readSessions(sql,{days:90,page:1})]]) {
      const warm = await read();
      if(name==='overview') assert.deepEqual(warm.totals,{visitors:5000,sessions:10000,page_views:20000,telegram_clicks:10000,analytics_conversions:0});
      else { assert.equal(warm.total,10000); assert.equal(warm.items.length,50); }
      measurements[name]=[];
      for(let sample=0;sample<3;sample++){const start=performance.now();await read();measurements[name].push(Math.round((performance.now()-start)*10)/10);}
      writeFileSync(`${output}/performance.json`,JSON.stringify({environment,rows:100000,sessions:10000,days:90,warmup:1,samples:3,measurements},null,2));
      assert(Math.max(...measurements[name])<=1000, `${name}: ${Math.max(...measurements[name])} ms exceeds 1000 ms`);
    }
    return measurements;
  });
} finally { await sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`; await sql.end(); }
