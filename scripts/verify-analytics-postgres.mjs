// Real HTTP -> Next -> Analytics container -> isolated PostgreSQL. Synthetic only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import postgres from "postgres";

const root = process.cwd();
const output = resolve(root, ".verification/website-analytics");
mkdirSync(output, { recursive: true });
const origin = process.argv.includes("--production") ? "https://localhost:44453" : "http://localhost:43828";
const service = "http://127.0.0.1:45440";
const key = "synthetic-analytics-key-at-least-32-bytes";
const sql = postgres("postgresql://analytics_user:synthetic-analytics-only@127.0.0.1:45442/deutschmit_analytics", { connect_timeout: 2, onnotice: () => {} });
const site = postgres("postgresql://site_test:synthetic-site-only@127.0.0.1:45443/site_analytics_acceptance", { connect_timeout: 2, onnotice: () => {} });
const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA)$/i.test(name)));
function docker(args, succeeds = true) {
  const result = spawnSync("docker", ["--config", resolve(root, ".docker-test-config"), ...args], { cwd: root, env: safeEnv, encoding: "utf8", windowsHide: true, timeout: 60_000 });
  assert.equal(result.status === 0, succeeds, `Synthetic Docker operation failed: ${result.error?.code ?? ""} ${result.stderr?.slice(-1500) ?? ""}`);
  return result.stdout.trim();
}
const compose = (operation, service) => {
  assert(["start", "stop", "restart"].includes(operation));
  assert(["analytics", "analytics-db"].includes(service));
  return docker([operation, `website-analytics-acceptance-${service}-1`]);
};
const cli = ["exec", "website-analytics-acceptance-analytics-1", "node", "dist/services/analytics/src/cli.js"];
const maintenance = (...args) => docker([...cli, ...args]);
let cookie = "";
let source = 1;
async function call(path, { internal = false, auth = true, method = "GET", body, headers = {} } = {}) {
  return fetch((internal ? service : origin) + path, { method, redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${source++ % 240 + 1}`, ...(internal ? auth ? { Authorization: `Bearer ${key}` } : {} : auth ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
}
const ingest = (events, options = {}) => call("/api/public/analytics/events", { method: "POST", body: { events }, ...options });
const internalIngest = (events, server = false, options = {}) => call(`/internal/events/${server ? "server" : "browser"}`, { internal: true, method: "POST", body: { events }, ...options });
async function read(session) { const response = await call(`/api/admin/analytics/sessions/${session}`); assert.equal(response.status, 200); return response.json(); }
async function healthy() {
  for (let i = 0; i < 40; i++) { try { if ((await call("/health", { internal: true })).status === 200) return; } catch {} await delay(500); }
  throw new Error("Synthetic Analytics failed to recover");
}
const results = [];
async function step(name, fn) {
  try { await fn(); results.push({ name, result: "PASS" }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, result: "FAIL", error: error.message }); throw error; }
  finally { writeFileSync(resolve(output, "postgres-results.json"), JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2)); }
}
const visitorA = randomUUID(), visitorB = randomUUID();
const a1 = randomUUID(), a2 = randomUUID(), b1 = randomUUID();
const p1 = randomUUID(), p2 = randomUUID(), p3 = randomUUID(), p4 = randomUUID();
const formId = randomUUID(), attempt = randomUUID(), conversion = randomUUID(), run = randomUUID();
const sequences = new Map();
function event(name = "page_view", metadata = {}, session = a1, page = p1, path = "/", visitor = visitorA) {
  const sequence = (sequences.get(session) ?? 0) + 1; sequences.set(session, sequence);
  return { product_id: "deutschmit", event_id: randomUUID(), event_name: name, schema_version: 1, visitor_id: visitor, session_id: session, page_view_id: page, sequence: name === "form_success" ? null : sequence, occurred_at: new Date().toISOString(), path, metadata };
}
const events = [
  event("session_start", { entry_path: "/" }), event(),
  event("page_view", {}, a1, p2, "/wissen"), event("engagement", { active_ms: 30_000 }, a1, p2, "/wissen"), event("engagement", { active_ms: 60_000 }, a1, p2, "/wissen"),
  event("element_impression", { element_id: "telegram_cta", placement: "wissen" }, a1, p2, "/wissen"), event("element_click", { element_id: "telegram_cta", placement: "wissen", destination: "telegram" }, a1, p2, "/wissen"),
  event("page_leave", { reason: "navigation", active_ms: 60_000, scroll_percent: 90 }, a1, p2, "/wissen"),
  ...[["session_start", { entry_path: "/contact", utm_campaign: "test" }], ["page_view", {}], ["form_open", { form_id: "student", form_instance_id: formId }], ["form_submit", { form_id: "student", form_instance_id: formId, submission_attempt_id: attempt }], ["form_submit", { form_id: "student", form_instance_id: randomUUID(), submission_attempt_id: randomUUID() }], ["form_error", { form_id: "partner", form_instance_id: randomUUID(), error_code: "network_error" }]].map(([name, metadata]) => event(name, { ...metadata, utm_campaign: "test" }, a2, p3, "/contact")),
  ...[["session_start", { entry_path: "/artikel/deutsche-sprache-geschichte" }], ["page_view", {}], ["scroll_depth", { threshold: 90 }], ["engagement", { active_ms: 60_000 }], ["article_read", { article_id: "deutsche-sprache-geschichte", rule_version: 1 }], ["quiz_started", { quiz_run_id: run, quiz_id: "daily" }], ["quiz_completed", { quiz_run_id: run, quiz_id: "daily", answered_count: 5, correct_count: 3 }], ["element_impression", { element_id: "second_cta", placement: "article" }], ["frontend_error", { component_id: "quiz", error_code: "quiz_network_error" }]].map(([name, metadata]) => event(name, metadata, b1, p4, "/artikel/deutsche-sprache-geschichte", visitorB)),
];
const success = event("form_success", { form_id: "student", form_instance_id: formId, submission_attempt_id: attempt, conversion_id: conversion, utm_campaign: "test" }, a2, p3, "/contact");
let siteBefore;
async function siteSnapshot() { return site`SELECT (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM contact_requests c) AS contacts, (SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM website_analytics_events w) AS legacy`; }
try {
  await healthy();
  await step("one event table, one unique constraint, exactly three query indexes; idempotent migrations", async () => {
    assert.deepEqual((await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`).map(row => row.tablename), ["analytics_events"]);
    assert.equal((await sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='analytics_events'`).length, 4);
    maintenance("migrate"); maintenance("migrate");
  });
  await step("owner login, anonymous API denial, empty session is distinct from outage", async () => {
    assert.equal((await call(`/api/admin/analytics/sessions/${a1}`, { auth: false })).status, 401);
    const login = await call("/api/admin/login", { method: "POST", body: { email: "site@example.test", password: "synthetic-site-password" } });
    assert.equal(login.status, 200); cookie = login.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
    assert.deepEqual((await read(randomUUID())).events, []);
    assert.equal((await call(`/api/admin/analytics/sessions/${a1}?product=quiz-arena`)).status, 400);
    assert.equal((await call("/api/admin/analytics/sessions/invalid")).status, 400);
  });
  await step("old website statistics and contact requests remain functional in separate PostgreSQL", async () => {
    const id = randomUUID();
    await site`INSERT INTO contact_requests (id,type,name,contact,payload) VALUES (${id},'student','Synthetic acceptance','synthetic@example.test','{"type":"student"}'::jsonb)`;
    await site`INSERT INTO website_analytics_events (event_type,visitor_id,path,event_timestamp) VALUES ('page_view',${randomUUID()},'/',now())`;
    for (const days of [7, 30, 90]) assert.equal((await call(`/api/admin/website-analytics/overview?days=${days}`)).status, 200);
    assert.equal((await call("/api/admin/contact-requests")).status, 200);
    assert.equal((await call("/api/admin/contact-requests", { method: "PATCH", body: { id, expected_status: "NEW", status: "DONE" } })).status, 200);
    assert.equal((await site`SELECT status FROM contact_requests WHERE id=${id}`)[0].status, "DONE");
    siteBefore = await siteSnapshot();
  });
  await step("all 15 event types: public/server HTTP -> committed PostgreSQL -> protected session read", async () => {
    for (const session of [a1, a2, b1]) { const batch = events.filter(e => e.session_id === session); const response = await ingest(batch); assert.equal(response.status, 200); assert.equal((await response.json()).inserted, batch.length); }
    const response = await internalIngest([success], true); assert.equal(response.status, 200); assert.equal((await response.json()).inserted, 1);
    for (const session of [a1, a2, b1]) { const data = await read(session); assert(data.generated_at); assert(data.last_received_at); assert(data.history_available_from); assert(data.events.every(e => e.product_id === "deutschmit" && e.session_id === session)); }
    const [counts] = await sql`SELECT count(DISTINCT event_name)::int AS names, count(*)::int AS total FROM analytics_events WHERE visitor_id IN (${visitorA},${visitorB})`;
    assert.equal(counts.names, 15); assert.equal(counts.total, events.length + 1);
  });
  await step("exact retry and concurrent duplicate deliveries do not change counts or received_at", async () => {
    const click = events.find(e => e.event_name === "element_click");
    const quiz = events.find(e => e.event_name === "quiz_completed");
    const [before] = await sql`SELECT count(*)::int AS count, max(received_at) AS last FROM analytics_events WHERE visitor_id IN (${visitorA},${visitorB})`;
    for (const response of await Promise.all([ingest([click]), ingest([quiz]), internalIngest([success], true), ingest([click]), internalIngest([success], true)])) { assert.equal(response.status, 200); assert.equal((await response.json()).inserted, 0); }
    const [after] = await sql`SELECT count(*)::int AS count, max(received_at) AS last FROM analytics_events WHERE visitor_id IN (${visitorA},${visitorB})`;
    assert.deepEqual(after, before);
    const fresh = event();
    const results = await Promise.all(Array.from({ length: 8 }, () => ingest([fresh]).then(async r => { assert.equal(r.status, 200); return r.json(); })));
    assert.equal(results.reduce((sum, r) => sum + r.inserted, 0), 1);
    await sql`DELETE FROM analytics_events WHERE event_id=${fresh.event_id} AND visitor_id=${visitorA}`;
  });
  await step("SQL control dataset: 2 visitors, 3 sessions, 4 views, 1 click/success/quiz/read and cumulative 60 seconds", async () => {
    const [row] = await sql`SELECT count(DISTINCT visitor_id)::int AS visitors, count(DISTINCT session_id)::int AS sessions, count(DISTINCT page_view_id) FILTER (WHERE event_name='page_view')::int AS views, count(*) FILTER (WHERE event_name='element_click')::int AS clicks, count(DISTINCT metadata->>'conversion_id') FILTER (WHERE event_name='form_success')::int AS successes, count(DISTINCT metadata->>'quiz_run_id') FILTER (WHERE event_name='quiz_completed')::int AS quizzes, count(*) FILTER (WHERE event_name='article_read')::int AS reads, max((metadata->>'active_ms')::int) FILTER (WHERE path='/wissen') AS active_ms FROM analytics_events WHERE visitor_id IN (${visitorA},${visitorB})`;
    assert.deepEqual(row, { visitors: 2, sessions: 3, views: 4, clicks: 1, successes: 1, quizzes: 1, reads: 1, active_ms: 60_000 });
    writeFileSync(resolve(output, "synthetic-counts.json"), JSON.stringify(row, null, 2));
  });
  await step("bad source/product/fields/time/batch/body/access reject atomically on both boundaries", async () => {
    const [before] = await sql`SELECT count(*)::int AS count FROM analytics_events`;
    for (const bad of [{ ...event(), product_id: "quiz-arena" }, success, { ...event(), source: "server" }, { ...event(), received_at: new Date().toISOString() }, { ...event(), metadata: { email: "synthetic@example.test" } }, { ...event(), occurred_at: new Date(Date.now() - 600_000).toISOString() }, { ...event(), occurred_at: new Date(Date.now() + 120_000).toISOString() }]) {
      assert.equal((await ingest([event(), bad])).status, 400);
      assert.equal((await internalIngest([event(), bad])).status, 400);
    }
    assert.equal((await internalIngest([event()], true)).status, 400);
    assert.equal((await ingest(Array.from({ length: 21 }, () => event()))).status, 400);
    assert.equal((await internalIngest(Array.from({ length: 21 }, () => event()))).status, 400);
    for (const internal of [false, true]) {
      const path = internal ? "/internal/events/browser" : "/api/public/analytics/events";
      assert.equal((await call(path, { internal, method: "POST", body: JSON.stringify("x".repeat(33_000)) })).status, 413);
      assert.equal((await call(path, { internal, method: "POST", body: "{" })).status, 400);
    }
    assert.equal((await ingest([event()], { headers: { Origin: "https://foreign.example.test" } })).status, 403);
    assert.equal((await internalIngest([event()], false, { auth: false })).status, 401);
    assert.equal((await internalIngest([success], true, { auth: false })).status, 401);
    assert.equal((await call(`/internal/products/deutschmit/sessions/${a1}`, { internal: true, auth: false })).status, 401);
    assert.equal((await call(`/internal/products/quiz-arena/sessions/${a1}`, { internal: true })).status, 404);
    assert.equal((await call("/api/public/analytics/events/server", { method: "POST", body: { events: [success] } })).status, 404);
    assert.deepEqual((await sql`SELECT count(*)::int AS count FROM analytics_events`)[0], before);
  });
  await step("deferred COMMIT failure rolls back the entire batch and never acknowledges success", async () => {
    const first = event(), fail = event();
    await sql.unsafe(`CREATE FUNCTION acceptance_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id = '${fail.event_id}'::uuid THEN RAISE EXCEPTION 'synthetic_failure'; END IF; RETURN NEW; END $$`);
    await sql`CREATE CONSTRAINT TRIGGER acceptance_commit_failure AFTER INSERT ON analytics_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acceptance_commit_failure()`;
    try { assert.equal((await ingest([first, fail])).status, 503); assert.equal((await sql`SELECT count(*)::int AS count FROM analytics_events WHERE event_id IN (${first.event_id}, ${fail.event_id})`)[0].count, 0); }
    finally { await sql`DROP TRIGGER acceptance_commit_failure ON analytics_events`; await sql`DROP FUNCTION acceptance_commit_failure()`; }
  });
  await step("privacy normalization persists safe campaign context and unknown markers without raw values", async () => {
    const visitor = randomUUID(), session = randomUUID();
    const sample = event("page_view", { utm_source: "Instagram", utm_medium: "Paid Social", utm_campaign: "Herbst Kurs 2026", referrer_host: "https://private.example.test/path" }, session, randomUUID(), "?private=value", visitor);
    assert.equal((await ingest([sample])).status, 200);
    const [stored] = (await read(session)).events;
    assert.equal(stored.path, "unknown");
    assert.deepEqual(stored.metadata, { utm_source: "instagram", utm_medium: "paid-social", utm_campaign: "Herbst-Kurs-2026", referrer_host: "unknown" });
    assert(!JSON.stringify(stored).includes("private"));
    assert.equal(JSON.parse(maintenance("delete-visitor", "deutschmit", visitor)).deleted, 1);
  });
  await step("60 requests/minute per network source; forged preceding forwarding values cannot bypass", async () => {
    const duplicate = events[0];
    for (let i = 0; i < 60; i++) assert.equal((await ingest([duplicate], { headers: { "X-Forwarded-For": `203.0.113.${i}, 198.51.100.17` } })).status, 200);
    const response = await ingest([duplicate], { headers: { "X-Forwarded-For": "203.0.113.200, 198.51.100.17" } });
    assert.equal(response.status, 429); assert(Number(response.headers.get("retry-after")) > 0);
    assert.equal((await ingest([duplicate], { headers: { "X-Forwarded-For": "198.51.100.18" } })).status, 200);
  });
  await step("service and PostgreSQL restart preserve committed events and volume", async () => {
    const before = (await read(a1)).events;
    compose("restart", "analytics"); await healthy(); assert.deepEqual((await read(a1)).events, before);
    compose("restart", "analytics-db"); await healthy(); assert.deepEqual((await read(a1)).events, before);
  });
  await step("database outage returns 503 for writes/reads/health; website and picker stay available", async () => {
    compose("stop", "analytics-db");
    try {
      assert.equal((await ingest([event()])).status, 503);
      assert.equal((await call(`/api/admin/analytics/sessions/${a1}`)).status, 503);
      assert.equal((await call("/health", { internal: true })).status, 503);
      for (const path of ["/", "/admin/products", "/admin/deutschmit/overview", "/api/admin/contact-requests", "/api/admin/website-analytics/overview"]) assert.equal((await call(path)).status, 200);
    } finally { compose("start", "analytics-db"); await healthy(); }
    assert.equal((await read(a1)).events.length, events.filter(e => e.session_id === a1).length);
  });
  await step("service outage does not block website; reconnection works without retrying writes", async () => {
    compose("stop", "analytics");
    try { assert.equal((await ingest([event()])).status, 503); assert.equal((await call(`/api/admin/analytics/sessions/${a1}`)).status, 503); assert.equal((await call("/admin/products")).status, 200); }
    finally { compose("start", "analytics"); await healthy(); }
  });
  await step("retention and visitor CLI delete only the targeted analytics rows; site/legacy stay identical", async () => {
    const target = randomUUID(), other = randomUUID();
    const old = event("page_view", {}, randomUUID(), randomUUID(), "/", target), fresh = event("page_view", {}, randomUUID(), randomUUID(), "/", target), kept = event("page_view", {}, randomUUID(), randomUUID(), "/", other);
    assert.equal((await ingest([old, fresh, kept])).status, 200);
    await sql`UPDATE analytics_events SET occurred_at=statement_timestamp() - interval '90 days 5 seconds' WHERE event_id=${old.event_id}`;
    await sql`UPDATE analytics_events SET occurred_at=statement_timestamp() - interval '90 days' + interval '30 seconds' WHERE event_id=${fresh.event_id}`;
    assert(JSON.parse(maintenance("retention")).deleted >= 1);
    assert.equal((await sql`SELECT count(*)::int AS count FROM analytics_events WHERE event_id=${old.event_id}`)[0].count, 0);
    assert.equal((await sql`SELECT count(*)::int AS count FROM analytics_events WHERE visitor_id=${target}`)[0].count, 1);
    for (const args of [["quiz-arena", target], ["deutschmit", "x' OR true --"]]) docker([...cli, "delete-visitor", ...args], false);
    assert.equal(JSON.parse(maintenance("delete-visitor", "deutschmit", target)).deleted, 1);
    assert.equal(JSON.parse(maintenance("delete-visitor", "deutschmit", target)).deleted, 0);
    assert.equal((await sql`SELECT count(*)::int AS count FROM analytics_events WHERE visitor_id=${other}`)[0].count, 1);
    assert.deepEqual(await siteSnapshot(), siteBefore);
    docker(["exec", "-e", "ANALYTICS_DATABASE_URL=postgresql://site_test:synthetic-site-only@site-db:5432/site_analytics_acceptance", "website-analytics-acceptance-analytics-1", "node", "dist/services/analytics/src/cli.js", "retention"], false);
  });
  console.log(`PASS: ${results.length} real PostgreSQL acceptance groups`);
} finally { await sql.end({ timeout: 3 }); await site.end({ timeout: 3 }); }
