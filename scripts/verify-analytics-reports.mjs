// Step 5: isolated schema, real PostgreSQL/service/Next/browser. No production data.
// Requires prepare-analytics-acceptance.mjs start --reports and the HTTPS helper.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";

const origin = "https://localhost:44453", serviceUrl = "http://127.0.0.1:45441";
const key = "synthetic-analytics-key-at-least-32-bytes";
const databaseUrl = "postgresql://analytics_user:synthetic-analytics-only@127.0.0.1:45442/deutschmit_analytics";
const schema = `step5_${randomUUID().replaceAll("-", "")}`;
const output = ".verification/website-analytics/step-5";
mkdirSync(output, { recursive: true });
const sql = postgres(databaseUrl, { connect_timeout: 3, connection: { search_path: schema }, onnotice: () => {} });
const site = postgres("postgresql://site_test:synthetic-site-only@127.0.0.1:45443/site_analytics_acceptance", { connect_timeout: 3 });
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA)$/i.test(name)));
let service, browser, admin, page;
const results = [], errors = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { const value = await fn(); if (value) return value; await wait(100); } throw new Error("Expected local state did not arrive"); }
async function check(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); console.log(`PASS: ${name}`); }
  catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
    if (page) { await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); writeFileSync(`${output}/failure.txt`, await page.locator("body").innerText()); }
    throw error;
  }
  finally { writeFileSync(`${output}/results.json`, JSON.stringify({ generated_at: new Date().toISOString(), results, errors }, null, 2)); }
}
async function internal(path, events) {
  const response = await fetch(serviceUrl + path, { method: events ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: events ? JSON.stringify({ events }) : undefined });
  assert.equal(response.status, 200); return response.json();
}
async function report(path) {
  const response = await admin.request.get(origin + "/api/admin/analytics/deutschmit/" + path);
  assert.equal(response.status(), 200, path);
  assert.equal(response.headers()["cache-control"], "private, no-store");
  return response.json();
}
async function shown(text) { await page.getByText(text, { exact: false }).first().waitFor(); }
const visitorA = randomUUID(), visitorB = randomUUID(), a1 = randomUUID(), a2 = randomUUID(), b1 = randomUUID();
const p1 = randomUUID(), p2 = randomUUID(), p3 = randomUUID(), p4 = randomUUID(), attempt = randomUUID(), instance = randomUUID(), run = randomUUID();
const sequences = new Map();
function event(name, session, view, path, metadata = {}, visitor = visitorA) {
  const sequence = (sequences.get(session) ?? 0) + 1; sequences.set(session, sequence);
  return { product_id: "deutschmit", event_id: randomUUID(), event_name: name, schema_version: 1, visitor_id: visitor, session_id: session, page_view_id: view, sequence, occurred_at: new Date(Date.now() - 2000 + sequence).toISOString(), path, metadata };
}
async function insert(rows) {
  await sql`INSERT INTO analytics_events ${sql(rows.map(e => ({ ...e, source: e.event_name === "form_success" ? "server" : "browser", metadata: sql.json(e.metadata) })))}`;
}
const totals = { visitors: 2, sessions: 3, page_views: 4, telegram_clicks: 1, analytics_conversions: 1 };
try {
  await sql`CREATE SCHEMA ${sql(schema)}`;
  await sql`CREATE TABLE analytics_events (LIKE public.analytics_events INCLUDING ALL)`;
  const legacyBefore = await site`SELECT to_jsonb(t) AS row FROM website_analytics_events t ORDER BY id`;
  const contactsBefore = await site`SELECT to_jsonb(t) AS row FROM contact_requests t ORDER BY id`;
  service = spawn(process.execPath, [resolve("services/analytics/dist/services/analytics/src/main.js")], { windowsHide: true, stdio: "ignore", env: { ...env, ANALYTICS_DATABASE_URL: `${databaseUrl}?search_path=${schema}`, ANALYTICS_SERVICE_KEY: key, ANALYTICS_HOST: "127.0.0.1", ANALYTICS_PORT: "45441" } });
  await until(async () => { try { return (await fetch(serviceUrl + "/health", { headers: { Authorization: `Bearer ${key}` } })).ok; } catch { return false; } });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  admin = await browser.newContext({ ignoreHTTPSErrors: true });
  await admin.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
  page = await admin.newPage(); page.setDefaultTimeout(20_000); page.on("pageerror", error => errors.push(error.message));
  await check("anonymous report pages/APIs are protected; empty source differs from measured zero", async () => {
    for (const path of ["overview", "sessions", "pages", "events", "traffic", "conversions", `sessions/${a1}`]) {
      const response = await admin.request.get(`${origin}/api/admin/analytics/deutschmit/${path}`);
      assert.equal(response.status(), 401); assert.equal(response.headers()["cache-control"], "private, no-store");
      await page.goto(`${origin}/admin/deutschmit/${path}`); assert.equal(new URL(page.url()).pathname, "/admin/login");
    }
    const login = await admin.request.post(origin + "/api/admin/login", { data: { email: "site@example.test", password: "synthetic-site-password" }, headers: { Origin: origin } });
    assert.equal(login.status(), 200);
    await page.goto(origin + "/admin/deutschmit"); await page.waitForURL("**/deutschmit/overview");
    await shown("Es liegen noch keine Beobachtungen vor"); assert.equal(await page.locator("article").count(), 0);
    const empty = await report("overview?days=7"); assert.equal(empty.history_available_from, null); assert.equal(empty.daily_series.length, 7);
    for (const query of ["overview?product=quiz-arena", "overview?days=7&days=30", "sessions?source=legacy", "sessions?path=/admin", "sessions?event_name=invalid", `sessions/${a1}?product=quiz-arena`]) assert.equal((await admin.request.get(`${origin}/api/admin/analytics/deutschmit/${query}`)).status(), 400);
  });
  await check("section 6 fixture: real contact commit, semantic retries, SQL = service = Next API = UI for 7/30/90", async () => {
    const form = { form_id: "student", form_instance_id: instance, submission_attempt_id: attempt, utm_campaign: "test" };
    const rows = [
      event("session_start", a1, p1, "/", { entry_path: "/" }), event("page_view", a1, p1, "/"),
      event("page_view", a1, p2, "/wissen"), event("engagement", a1, p2, "/wissen", { active_ms: 30_000 }), event("engagement", a1, p2, "/wissen", { active_ms: 60_000 }),
      event("element_impression", a1, p2, "/wissen", { element_id: "telegram_cta", placement: "wissen" }), event("element_click", a1, p2, "/wissen", { element_id: "telegram_cta", placement: "wissen", destination: "telegram" }),
      event("session_start", a2, p3, "/contact", { entry_path: "/contact", utm_campaign: "test" }), event("page_view", a2, p3, "/contact", { utm_campaign: "test" }),
      event("form_open", a2, p3, "/contact", { form_id: "student", form_instance_id: instance, utm_campaign: "test" }), event("form_submit", a2, p3, "/contact", form),
      event("form_submit", a2, p3, "/contact", { ...form, submission_attempt_id: randomUUID() }),
      event("session_start", b1, p4, "/artikel/deutsche-sprache-geschichte", { entry_path: "/artikel/deutsche-sprache-geschichte" }, visitorB),
      ...[["page_view", {}], ["scroll_depth", { threshold: 90 }], ["engagement", { active_ms: 60_000 }], ["article_read", { article_id: "deutsche-sprache-geschichte", rule_version: 1 }], ["quiz_started", { quiz_run_id: run, quiz_id: "daily" }], ["quiz_completed", { quiz_run_id: run, quiz_id: "daily", answered_count: 5, correct_count: 3 }], ["element_impression", { element_id: "second_cta", placement: "article" }]].map(([name, metadata]) => event(name, b1, p4, "/artikel/deutsche-sprache-geschichte", metadata, visitorB)),
    ];
    for (const session of [a1, a2, b1]) await internal("/internal/events/browser", rows.filter(e => e.session_id === session));
    const contact = { type: "student", name: `Synthetic ${schema}`, ageGroup: "16_25", level: "B1", goals: ["alltag"], format: "individual", timeSlots: ["evening"], frequency: "twice", budget: "50_100", contact: "synthetic@example.test", message: "", company: "", analytics: { consent: "granted", schema_version: 1, visitor_id: visitorA, session_id: a2, page_view_id: p3, path: "/contact", entry_path: "/contact", ...form } };
    assert.equal((await admin.request.post(origin + "/api/contact", { data: contact, headers: { Origin: origin } })).status(), 202);
    assert.equal((await site`SELECT count(*)::int AS n FROM contact_requests WHERE name=${contact.name}`)[0].n, 1);
    assert.equal((await admin.request.post(origin + "/api/contact", { data: { ...contact, company: "honeypot" }, headers: { Origin: origin } })).status(), 202);
    const success = (await sql`SELECT * FROM analytics_events WHERE event_name='form_success'`)[0]; assert(success);
    // Node on Windows and PostgreSQL in Docker have independent clocks. Reports
    // correctly exclude future occurred_at values even after ingestion commits.
    const [clock] = await sql`SELECT occurred_at, statement_timestamp() AS database_now,
      extract(epoch FROM (occurred_at - statement_timestamp())) * 1000 AS ahead_ms
      FROM analytics_events WHERE event_id=${success.event_id}`;
    writeFileSync(`${output}/fixture-clock.json`, JSON.stringify(clock, null, 2));
    await until(async () => (await sql`SELECT occurred_at < statement_timestamp() AS visible
      FROM analytics_events WHERE event_id=${success.event_id}`)[0].visible);
    const { source: _source, received_at: _received, ...retry } = success;
    await internal("/internal/events/server", [retry]);
    await internal("/internal/events/browser", [rows.find(e => e.event_name === "element_click")]);
    await internal("/internal/events/browser", [rows.find(e => e.event_name === "quiz_completed")]);
    await insert([{ ...retry, event_id: randomUUID() }, ...rows.filter(e => ["page_view", "quiz_completed"].includes(e.event_name)).map(e => ({ ...e, event_id: randomUUID() }))]);
    const [control] = await sql`SELECT count(DISTINCT visitor_id)::int AS visitors, count(DISTINCT session_id)::int AS sessions,
      count(DISTINCT page_view_id) FILTER(WHERE event_name='page_view')::int AS page_views,
      count(*) FILTER(WHERE event_name='element_click' AND metadata->>'destination'='telegram')::int AS telegram_clicks,
      count(DISTINCT metadata->>'conversion_id') FILTER(WHERE source='server' AND event_name='form_success')::int AS analytics_conversions FROM analytics_events`;
    assert.deepEqual(control, totals);
    for (const days of [7, 30, 90]) {
      assert.deepEqual((await internal(`/internal/products/deutschmit/overview?days=${days}`)).totals, totals);
      const data = await report(`overview?days=${days}`); assert.deepEqual(data.totals, totals); assert.equal(data.daily_series.length, days);
      assert.equal(new Set(data.daily_series.map(e => e.date)).size, days);
      await page.getByLabel("Zeitraum", { exact: true }).selectOption(String(days));
      if (days === 7) await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
      await until(async () => await page.locator("tbody").first().locator("tr").count() === days);
      assert.deepEqual(await page.locator("article p:last-child").allTextContents(), ["2", "3", "4", "1", "1"]);
      assert.equal((await page.locator("tbody").nth(1).locator("tr").count()), 4);
    }
    const sessions = await report("sessions?days=7"); assert.equal(sessions.total, 3);
    const summary = sessions.items.find(e => e.session_id === a1); assert.equal(summary.active_ms, 60_000); assert.equal(summary.first_page, "/"); assert.equal(summary.last_page, "/wissen");
    assert.equal(sessions.items.find(e => e.session_id === a2).entry_source, "test"); assert.equal(sessions.items.find(e => e.session_id === a2).active_ms, null);
    assert.equal(sessions.items.find(e => e.session_id === b1).quiz_completions, 1);
    writeFileSync(`${output}/control.json`, JSON.stringify({ sql: control, sessions, overview: await report("overview?days=90") }, null, 2));
    await page.screenshot({ path: `${output}/overview.png`, fullPage: true });
  });
  await check("four application reports: control totals, real browser tables, UTC filters and exact session drilldowns", async () => {
    const pages = await report('pages?days=7'); assert.equal(pages.items.find(row=>row.path==='/wissen').average_active_ms,60000);
    const events = await report('events?days=7'); assert.equal(events.elements.find(row=>row.element_id==='telegram_cta').matched_click_views,1); assert.equal(events.elements.find(row=>row.element_id==='second_cta').matched_click_views,0);
    const traffic = await report('traffic?days=7'); assert.equal(traffic.items.find(row=>row.source_kind==='direct').sessions,2); assert.equal(traffic.items.find(row=>row.utm_campaign==='test').analytics_conversions,1);
    const conversions = await report('conversions?days=7'); assert.equal(conversions.forms.find(row=>row.form_id==='student').successes,1); assert.equal(conversions.quizzes[0].completions,1);
    for(const name of ['pages','events','traffic','conversions']) {
      await page.goto(`${origin}/admin/deutschmit/${name}`); await page.locator('table').first().waitFor();
      await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
      await page.setViewportSize({width:390,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
      await page.screenshot({path:`${output}/${name}-mobile.png`,fullPage:true});
      await page.setViewportSize({width:1440,height:1000});
      let release; const gate=new Promise(resolve=>{release=resolve;});
      const pattern=`**/api/admin/analytics/deutschmit/${name}?days=30`;
      await page.route(pattern,async route=>{await gate; await route.continue();});
      await page.getByLabel('Zeitraum',{exact:true}).selectOption('30'); await shown('Wird geladen'); assert.equal(await page.locator('table').count(),0);
      release(); await page.locator('table').first().waitFor(); await page.unroute(pattern);
      const link=page.locator('table a').first(); const href=await link.getAttribute('href'); const query=new URL(href,origin).search;
      const expected=await report(`sessions${query}`); await link.click(); await shown(`Beobachtete Sitzungen: ${expected.total}`);
      assert.equal(await page.getByLabel('Zeitraum',{exact:true}).inputValue(),'30'); await shown('Berichtsfilter:');
    }
  });
  await check("read-time timeout, missing start/gaps, NULL versus measured zero, stable entry source", async () => {
    await sql`UPDATE analytics_events SET occurred_at=occurred_at - interval '31 minutes' WHERE source='browser' AND session_id=${a2}`;
    let data = await report(`sessions/${a2}`); assert.equal(data.summary.status, "timed_out"); assert.equal(data.summary.active_ms, null);
    await insert([event("engagement", a2, p3, "/contact", { active_ms: 0, utm_source: "later" })]);
    data = await report(`sessions/${a2}`); assert.equal(data.summary.status, "active"); assert.equal(data.summary.active_ms, 0); assert.equal(data.summary.entry_source, "test");
    const missing = randomUUID(); await insert([{ ...event("element_click", missing, randomUUID(), "/wissen", { element_id: "telegram_cta", placement: "wissen", destination: "telegram" }), sequence: 4 }]);
    data = await report(`sessions/${missing}`); assert.equal(data.summary.incomplete, true); assert.equal(data.summary.first_page, "/wissen"); assert.equal(data.summary.page_views, 0);
    await sql`DELETE FROM analytics_events WHERE session_id=${missing}`;
  });
  await check("period boundaries retain full session; long timeline includes all 1101 stored events", async () => {
    const boundary = randomUUID(), long = randomUUID(), view = randomUUID();
    const start = Date.parse((await report("overview?days=7")).period_start);
    await insert([{ ...event("session_start", boundary, view, "/", { entry_path: "/" }), occurred_at: new Date(start - 1000).toISOString() }, { ...event("page_view", boundary, view, "/wissen"), occurred_at: new Date(start).toISOString() }]);
    assert((await report("sessions?days=7")).items.some(e => e.session_id === boundary));
    const all = await report(`sessions/${boundary}`); assert.equal(all.events.length, 2); assert.equal(all.summary.first_page, "/");
    await page.goto(`${origin}/admin/deutschmit/sessions/${boundary}?days=7`); await shown("Außerhalb des Zeitraums"); assert.equal(await page.getByText("Außerhalb des Zeitraums", { exact: true }).count(), 1);
    await page.getByLabel("Zeitraum", { exact: true }).selectOption("30"); await shown("(30 Tage"); assert.equal(await page.getByText("Außerhalb des Zeitraums", { exact: true }).count(), 0);
    await insert(Array.from({ length: 1101 }, (_, i) => event(i ? "engagement" : "session_start", long, view, "/wissen", i ? { active_ms: i * 1000 } : { entry_path: "/wissen" })));
    assert.equal((await report(`sessions/${long}`)).events.length, 1101);
    await page.goto(`${origin}/admin/deutschmit/sessions/${long}`); await shown("Chronologische Timeline"); assert.equal(await page.locator("article").count(), 1101);
    await sql`DELETE FROM analytics_events WHERE session_id IN (${boundary},${long})`;
  });
  await check("50-item pagination and combined filters do not retain another selection's cache", async () => {
    const extras = Array.from({ length: 51 }, () => event("page_view", randomUUID(), randomUUID(), "/books")); await insert(extras);
    const first = await report("sessions?days=7"), second = await report("sessions?days=7&page=2");
    assert.equal(first.items.length, 50); assert.equal(second.items.length, 4); assert.equal(new Set([...first.items, ...second.items].map(e => e.session_id)).size, 54);
    assert.equal((await report("sessions?days=7&path=/wissen&event_name=element_click")).total, 1);
    assert.equal((await report("sessions?days=7&path=/contact&event_name=element_click")).total, 0);
    await page.goto(origin + "/admin/deutschmit/sessions"); await shown("Beobachtete Sitzungen: 54"); assert.equal(await page.locator("tbody tr").count(), 50);
    await page.getByRole("button", { name: "Weiter", exact: true }).click(); await shown("Seite 2 von 2"); assert.equal(await page.locator("tbody tr").count(), 4);
    await page.getByLabel("Seite", { exact: true }).fill("/contact"); await page.getByRole("button", { name: "Filter anwenden" }).click(); await shown("Beobachtete Sitzungen: 1");
    assert.equal(await page.locator("tbody tr").count(), 1); await shown("test");
    await page.getByLabel("Event-Typ", { exact: true }).selectOption("element_click"); await shown("Beobachtete Sitzungen: 0"); assert.equal(await page.locator("tbody tr").count(), 0);
    await sql`DELETE FROM analytics_events WHERE session_id IN ${sql(extras.map(e => e.session_id))}`;
  });
  await check("real browser session opens pages, scrolls, measures active time and clicks Telegram in Explorer", async () => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
    await context.addInitScript(() => document.addEventListener("click", event => {
      const anchor = event.target.closest?.("a");
      if (anchor && new URL(anchor.href).origin !== location.origin) event.preventDefault();
    }, true));
    const tab = await context.newPage();
    await tab.goto(origin + "/wissen?utm_campaign=Step5-browser");
    await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click();
    await tab.waitForFunction(() => JSON.parse(sessionStorage.getItem("deutschmit_analytics_session_v2"))?.sequence >= 2);
    const id = await tab.evaluate(() => JSON.parse(sessionStorage.getItem("deutschmit_analytics_session_v2")).id);
    await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(1200); await tab.mouse.move(300, 300); await wait(31_000);
    await tab.locator("header a[data-analytics-id='telegram_bot']:visible").first().click();
    await tab.bringToFront();
    await tab.locator("a[href='/']").first().click(); await tab.waitForURL(origin + "/");
    await until(async () => { const rows = await sql`SELECT event_name FROM analytics_events WHERE session_id=${id}`; return ["scroll_depth", "engagement", "element_click", "page_leave"].every(name => rows.some(e => e.event_name === name)); });
    await page.goto(`${origin}/admin/deutschmit/sessions/${id}`); await shown("Chronologische Timeline"); await shown("Step5-browser"); await shown("Scroll:"); await shown("Aktive Zeit:"); await shown("Klick: telegram");
    const data = await report(`sessions/${id}`); assert(data.summary.active_ms >= 30_000); assert(data.summary.page_views >= 2); assert.equal(data.summary.telegram_clicks, 1);
    writeFileSync(`${output}/real-session.json`, JSON.stringify(data, null, 2)); await page.screenshot({ path: `${output}/real-session.png`, fullPage: true });
    await tab.goto(origin + "/admin/login");
    await wait(1500);
    await context.close();
  });
  await check("measured zero, loading and stale snapshot have distinct states and manual refresh recalculates", async () => {
    await sql`UPDATE analytics_events SET occurred_at=occurred_at - interval '40 days'`;
    assert.deepEqual((await report("overview?days=7")).totals, { visitors: 0, sessions: 0, page_views: 0, telegram_clicks: 0, analytics_conversions: 0 });
    await page.clock.install();
    await page.goto(origin + "/admin/deutschmit/overview"); await shown("Im ausgewählten Zeitraum wurden keine Beobachtungen gespeichert");
    assert.deepEqual(await page.locator("article p:last-child").allTextContents(), ["0", "0", "0", "0", "0"]);
    let release; const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/api/admin/analytics/deutschmit/overview?days=30", async route => { await gate; await route.continue(); });
    await page.getByLabel("Zeitraum", { exact: true }).selectOption("30"); await shown("Wird geladen"); assert.equal(await page.locator("article").count(), 0); release();
    await shown("Alle 30 Tage"); await page.unroute("**/api/admin/analytics/deutschmit/overview?days=30");
    await page.clock.fastForward(6 * 60_000); await shown("Snapshot ist älter als 5 Minuten");
    await page.clock.setFixedTime(new Date());
    const refreshed = page.waitForResponse("**/api/admin/analytics/deutschmit/overview?days=30");
    await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
    assert.equal((await refreshed).status(), 200);
    await page.clock.fastForward(15_000);
    await until(async () => await page.getByText("Snapshot ist älter", { exact: false }).count() === 0);
  });
  await check("actual analytics stop is isolated; old metrics, requests, archive and other products remain available", async () => {
    service.kill(); await new Promise(resolve => service.once("exit", resolve)); service = null;
    await page.getByRole("button", { name: "Aktualisieren", exact: true }).click(); await shown("Analytics sind nicht verfügbar"); assert.equal(await page.locator("article").count(), 0);
    for (const path of ["overview?days=7", "sessions?days=7", `sessions/${a1}`]) assert.equal((await admin.request.get(`${origin}/api/admin/analytics/deutschmit/${path}`)).status(), 503);
    await page.getByRole("link", { name: "Стара статистика сайту", exact: true }).click(); await shown("Website Besucher");
    assert.equal((await admin.request.get(origin + "/api/admin/website-analytics/overview?days=7")).status(), 200);
    await page.getByRole("link", { name: "Заявки та архів" }).click(); await shown("Усього в цьому джерелі");
    await page.getByLabel("Джерело заявок").selectOption("legacy"); await shown("Архів потребує окремого входу");
    await page.goto(origin + "/admin/products"); assert.equal(await page.locator("main a").count(), 4);
    assert.deepEqual(await site`SELECT to_jsonb(t) AS row FROM website_analytics_events t ORDER BY id`, legacyBefore);
    const currentContacts = await site`SELECT to_jsonb(t) AS row FROM contact_requests t ORDER BY id`;
    for (const old of contactsBefore) assert(currentContacts.some(e => JSON.stringify(e) === JSON.stringify(old)));
    assert.deepEqual(errors, []);
  });
} finally {
  if (service) service.kill();
  await browser?.close();
  // This randomly named schema was created by this run; existing public data stays intact.
  await sql`DROP SCHEMA ${sql(schema)} CASCADE`;
  await sql.end(); await site.end();
}
