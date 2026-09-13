// Step 4: browser actions -> local HTTPS Next production -> two synthetic PostgreSQL stores.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";

const origin = "https://localhost:44453";
const output = ".verification/website-analytics/step-4-browser";
mkdirSync(output, { recursive: true });
const consentKey = "deutschmit_analytics_consent_v2", visitorKey = "deutschmit_analytics_visitor_v2", sessionKey = "deutschmit_analytics_session_v2";
const sql = postgres("postgresql://analytics_user:synthetic-analytics-only@127.0.0.1:45442/deutschmit_analytics", { connect_timeout: 3 });
const site = postgres("postgresql://site_test:synthetic-site-only@127.0.0.1:45443/site_analytics_acceptance", { connect_timeout: 3 });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] });
const results = [], analyticsRequests = [], analyticsStatuses = [], visitors = new Set(), stopped = new Set();
const marker = `Step4-${randomUUID().slice(0, 8)}`;
const privateText = "SYNTHETIC_PRIVATE_FORM_TEXT", privateContact = "synthetic-person@example.test";
const beforeContacts = await site`SELECT to_jsonb(t) AS row FROM contact_requests t ORDER BY id`;
const beforeLegacy = await site`SELECT to_jsonb(t) AS row FROM website_analytics_events t ORDER BY id`;
let latestContact, primaryVisitor, main, page, admin, rejectingContact = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function group(name, fn) {
  try { const evidence = await fn(); results.push({ name, status: "PASS", evidence }); console.log(`PASS: ${name}`); }
  catch (error) {
    results.push({ name, status: "FAIL", error: error.message, analyticsStatuses: analyticsStatuses.slice(-20) });
    if (!process.argv.includes("--continue-on-failure")) throw error;
    process.exitCode = 1;
    if (rejectingContact) { await site`ALTER TABLE contact_requests DROP CONSTRAINT step4_reject_synthetic_contact`; rejectingContact = false; await closeForm(); }
  }
  finally { writeFileSync(`${output}/results.json`, JSON.stringify({ generated_at: new Date().toISOString(), browser: browser.version(), marker, results }, null, 2)); }
}
function service(action, target) {
  assert(["stop", "start"].includes(action) && ["analytics", "site-db", "analytics-db"].includes(target));
  const result = spawnSync("docker", ["--config", resolve(".docker-test-config"), "compose", "--env-file", "NUL", "-f", "services/analytics/compose.acceptance.yml", action, target], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  assert.equal(result.status, 0, "Synthetic service operation failed");
  if (action === "stop") stopped.add(target); else stopped.delete(target);
}
async function context(storageBlocked = false) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 1000 } });
  await ctx.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
  await ctx.addInitScript(({ storageBlocked }) => {
    if (storageBlocked) for (const method of ["getItem", "setItem", "removeItem"]) Storage.prototype[method] = () => { throw new DOMException("synthetic storage denied", "SecurityError"); };
    // Keep actual handlers while preventing external visits and APK downloads.
    document.addEventListener("click", event => {
      const anchor = event.target.closest?.("a");
      if (anchor && (anchor.hasAttribute("download") || new URL(anchor.href).origin !== location.origin)) event.preventDefault();
    }, true);
  }, { storageBlocked });
  ctx.on("page", tab => {
    tab.on("response", response => { if (response.url().endsWith("/api/public/analytics/events")) analyticsStatuses.push(response.status()); });
    tab.setDefaultTimeout(25_000);
    tab.on("request", request => {
      if (request.url().includes("/api/public/") && request.url().includes("analytics")) analyticsRequests.push({ endpoint: new URL(request.url()).pathname, body: request.postDataJSON() });
      if (request.url() === origin + "/api/contact") latestContact = request.postDataJSON();
    });
  });
  return ctx;
}
async function ready(tab) {
  await tab.waitForFunction(key => JSON.parse(sessionStorage.getItem(key))?.sequence >= 2, sessionKey);
  const id = await tab.evaluate(key => JSON.parse(localStorage.getItem(key)).id, visitorKey); visitors.add(id); return id;
}
async function rows(visitor = primaryVisitor) { return sql`SELECT * FROM analytics_events WHERE visitor_id=${visitor} ORDER BY occurred_at, sequence, event_id`; }
async function waitRows(predicate, visitor = primaryVisitor) {
  const deadline = Date.now() + 20_000;
  do { const events = await rows(visitor); if (predicate(events)) return events; await wait(150); } while (Date.now() < deadline);
  throw new Error("Expected browser events did not reach isolated PostgreSQL");
}
async function telegram(tab = page) { await tab.locator("header a[data-analytics-id='telegram_bot']:visible").first().click(); }
async function settings(tab, choice) { await tab.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).click(); await tab.getByRole("button", { name: choice, exact: true }).click(); }
async function closeForm(tab = page) { await tab.getByRole("dialog").getByRole("button", { name: /schließen/i }).first().click(); }
async function openForm(form, tab = page) { await tab.locator(`[data-analytics-id='${form}_form']:visible`).first().click(); await tab.locator(`#${form}-name`).waitFor(); }
async function fillForm(form, suffix, tab = page) {
  await tab.locator(`#${form}-name`).fill(`${marker}-${suffix}`);
  if (form === "student") {
    for (const field of ["age-group", "level", "goals"]) await tab.locator(`#student-${field} button`).first().click();
    await tab.getByRole("button", { name: "Weiter", exact: false }).click();
    for (const field of ["format", "time", "frequency"]) await tab.locator(`#student-${field} button`).first().click();
    await tab.getByRole("button", { name: "Weiter", exact: false }).click();
    await tab.locator("#student-contact").fill(privateContact);
  } else {
    await tab.locator("#partner-type button").first().click();
    await tab.locator("#partner-country").fill("Synthetic city");
    for (const field of ["student-count", "offerings"]) await tab.locator(`#partner-${field} button`).first().click();
    await tab.getByRole("button", { name: "Weiter", exact: false }).click();
    await tab.locator("#partner-contact").fill(privateContact);
    await tab.locator("#partner-idea").fill(privateText);
    await tab.locator("#partner-start-timeline button").first().click();
  }
}
async function submit(form, tab = page) { await tab.getByRole("button", { name: form === "student" ? "Anfrage senden →" : "Vorschlag senden →", exact: true }).click(); }
async function contacts(suffix) { return site`SELECT * FROM contact_requests WHERE name=${`${marker}-${suffix}`}`; }

try {
  await group("pending/deny collect neither clicks, forms, errors nor analytics IDs", async () => {
    const ctx = await context(); const tab = await ctx.newPage(); await tab.goto(origin + "/contact");
    await telegram(tab); assert.equal(analyticsRequests.length, 0);
    await tab.getByRole("button", { name: "Analytics ablehnen", exact: true }).click();
    await openForm("student", tab); await tab.getByRole("button", { name: /Weiter/ }).click();
    await closeForm(tab); await openForm("partner", tab); await closeForm(tab);
    assert.equal(analyticsRequests.length, 0);
    assert.equal(await tab.evaluate(key => localStorage.getItem(key), visitorKey), null);
    await ctx.close();
  });
  await group("marked home CTA/menu/project clicks and impressions, one owner per physical click", async () => {
    main = await context(); page = await main.newPage(); await page.goto(origin + "/?utm_source=Instagram&utm_medium=Paid%20Social&utm_campaign=Step4-Campaign#private-fragment");
    await page.getByRole("button", { name: "Analytics erlauben", exact: true }).click(); primaryVisitor = await ready(page);
    await wait(1500); await telegram(); await telegram();
    await page.locator("[data-analytics-id='quiz_teaser_anchor']").click();
    for (const id of ["telegram_channel", "deutsch_trainer", "worklog_apk", "shorts_blocker"]) {
      const target = page.locator(`[data-analytics-id='${id}']:visible`).first(); await target.scrollIntoViewIfNeeded(); await wait(1300); await target.click();
    }
    await page.locator("[data-analytics-id='books']").click(); await page.waitForURL("**/books");
    const events = await waitRows(events => events.some(event => event.event_name === "page_leave"));
    const headerClicks = events.filter(event => event.event_name === "element_click" && event.path === "/" && event.metadata.element_id === "telegram_bot" && event.metadata.placement === "header");
    assert.equal(headerClicks.length, 2);
    for (const id of ["quiz_teaser_anchor", "telegram_channel", "deutsch_trainer", "worklog_apk", "shorts_blocker", "books"]) assert.equal(events.filter(event => event.event_name === "element_click" && event.metadata.element_id === id).length, 1, id);
    assert(events.some(event => event.event_name === "element_impression" && event.metadata.element_id === "telegram_bot" && event.metadata.placement === "header"));
    return { separateHeaderClicks: 2, session: events[0].session_id };
  });
  await group("both book formats produce distinct Amazon intent and matching impressions", async () => {
    for (const id of ["book_print", "book_ebook"]) { const target = page.locator(`[data-analytics-id='${id}']`); await target.scrollIntoViewIfNeeded(); await wait(1300); await target.click(); }
    const events = await waitRows(events => events.filter(event => event.event_name === "element_click" && event.metadata.destination === "amazon").length === 2);
    for (const id of ["book_print", "book_ebook"]) assert(events.some(event => event.event_name === "element_impression" && event.metadata.element_id === id));
    await page.screenshot({ path: `${output}/books.png`, fullPage: true });
  });
  await group("student form validation/network error, retry, exactly one committed server success", async () => {
    await page.goto(origin + "/contact"); await ready(page); await openForm("student");
    await page.getByRole("button", { name: /Weiter/ }).click(); await fillForm("student", "student");
    await page.route("**/api/contact", route => route.abort(), { times: 1 }); await submit("student");
    await page.getByText("Etwas ist schiefgelaufen. Bitte versuche es erneut.", { exact: true }).waitFor();
    const failedAttempt = latestContact.analytics.submission_attempt_id;
    await submit("student"); await page.getByText(`Danke, ${marker}-student!`, { exact: true }).waitFor();
    const context = latestContact.analytics;
    assert.notEqual(context.submission_attempt_id, failedAttempt);
    const saved = await contacts("student"); assert.equal(saved.length, 1); assert.equal(saved[0].payload.analytics, undefined);
    const events = await waitRows(events => events.some(event => event.event_name === "form_success" && event.metadata.submission_attempt_id === context.submission_attempt_id));
    assert.equal(events.filter(event => event.event_name === "form_success" && event.metadata.submission_attempt_id === context.submission_attempt_id).length, 1);
    assert(events.some(event => event.event_name === "form_error" && event.metadata.error_code === "validation_error"));
    assert(events.some(event => event.event_name === "form_error" && event.metadata.error_code === "network_error" && event.metadata.submission_attempt_id === failedAttempt));
    const success = events.find(event => event.event_name === "form_success"); assert.equal(success.source, "server"); assert.equal(success.sequence, null);
    assert.notEqual(success.metadata.conversion_id, saved[0].id); assert.equal(success.page_view_id, context.page_view_id);
    assert(new Date(success.occurred_at) >= new Date(saved[0].created_at));
    await closeForm(); return { contactRows: 1, successes: 1, separateRetryAttempt: true };
  });
  await group("partner form writes one contact and one server success with its own instance", async () => {
    await openForm("partner"); await fillForm("partner", "partner"); await submit("partner");
    await page.getByText(/Danke/).last().waitFor(); const context = latestContact.analytics;
    const saved = await contacts("partner"); assert.equal(saved.length, 1);
    const events = await waitRows(events => events.some(event => event.event_name === "form_success" && event.metadata.form_id === "partner"));
    assert.equal(events.filter(event => event.event_name === "form_success" && event.metadata.form_id === "partner").length, 1);
    for (const name of ["form_open", "form_submit", "form_success"]) assert(events.some(event => event.event_name === name && event.metadata.form_instance_id === context.form_instance_id));
    await closeForm();
  });
  await group("honeypot and invalid optional context cannot fabricate conversions or reject valid contacts", async () => {
    const body = { ...latestContact, name: `${marker}-honeypot`, company: "synthetic bot", analytics: { ...latestContact.analytics, submission_attempt_id: randomUUID() } };
    let response = await main.request.post(origin + "/api/contact", { headers: { Origin: origin }, data: body }); assert.equal(response.status(), 202);
    assert.equal((await contacts("honeypot")).length, 0);
    assert.equal((await rows()).filter(event => event.event_name === "form_success" && event.metadata.submission_attempt_id === body.analytics.submission_attempt_id).length, 0);
    response = await main.request.post(origin + "/api/contact", { headers: { Origin: origin }, data: { ...body, name: `${marker}-invalid-context`, company: "", analytics: { ...body.analytics, email: privateContact } } });
    assert.equal(response.status(), 202); assert.equal((await contacts("invalid-context")).length, 1);
    assert.equal((await rows()).filter(event => event.event_name === "form_success").length, 2);
  });
  await group("analytics outage preserves partner success and the saved request in existing Admin", async () => {
    service("stop", "analytics");
    await openForm("partner"); await fillForm("partner", "analytics-outage"); const started = Date.now(); await submit("partner");
    await page.getByText(/Danke/).last().waitFor(); const attempt = latestContact.analytics.submission_attempt_id;
    const saved = await contacts("analytics-outage"); assert.equal(saved.length, 1);
    assert.equal((await rows()).filter(event => event.event_name === "form_success" && event.metadata.submission_attempt_id === attempt).length, 0);
    const ctx = await context(); admin = await ctx.newPage(); await admin.goto(origin + "/admin/login");
    await admin.locator("#admin-email").fill("site@example.test"); await admin.locator("#admin-password").fill("synthetic-site-password");
    await admin.getByRole("button", { name: "Sign In", exact: true }).click(); await admin.waitForURL("**/admin/products");
    await admin.goto(origin + "/admin/deutschmit/requests"); await admin.getByRole("heading", { name: new RegExp(`${marker}-analytics-outage`) }).waitFor();
    const response = await ctx.request.get(origin + "/api/admin/contact-requests?page=1"); assert.equal(response.status(), 200);
    assert((await response.json()).items.some(item => item.id === saved[0].id));
    await admin.screenshot({ path: `${output}/request-during-analytics-outage.png`, fullPage: true });
    await ctx.close(); service("start", "analytics"); await page.bringToFront(); await closeForm();
    return { requestPreserved: true, analyticsSuccesses: 0, elapsedIncludingAdminMs: Date.now() - started };
  });
  await group("contact DB failure produces form_error and no server success", async () => {
    assert.equal((await site`SELECT current_database() AS name`)[0].name, "site_analytics_acceptance");
    // A server-side PostgreSQL rejection, scoped to this run's synthetic row.
    // Stopping the DB tests driver reconnection instead, which can leave the request pending.
    await site.unsafe("ALTER TABLE contact_requests ADD CONSTRAINT step4_reject_synthetic_contact CHECK (name <> '" + marker + "-contact-db-failure')");
    rejectingContact = true;
    await openForm("student"); await fillForm("student", "contact-db-failure"); await submit("student");
    await page.getByText("Etwas ist schiefgelaufen. Bitte versuche es erneut.", { exact: true }).waitFor(); const attempt = latestContact.analytics.submission_attempt_id;
    const events = await waitRows(events => events.some(event => event.event_name === "form_error" && event.metadata.submission_attempt_id === attempt));
    assert.equal(events.filter(event => event.event_name === "form_success" && event.metadata.submission_attempt_id === attempt).length, 0);
    await site`ALTER TABLE contact_requests DROP CONSTRAINT step4_reject_synthetic_contact`; rejectingContact = false;
    assert.equal((await contacts("contact-db-failure")).length, 0); await closeForm();
  });
  await group("actual daily quiz start/completion share a run; errors are fixed, bounded and omit private text", async () => {
    await page.goto(origin + "/"); await ready(page);
    await page.getByRole("button", { name: "Heutige Runde starten", exact: true }).click();
    for (let index = 0; index < 5; index++) {
      await page.locator("#quiz-teaser button[aria-pressed]:enabled").first().click();
      if (index < 4) await page.getByRole("button", { name: "Nächste Frage", exact: true }).click();
    }
    await page.getByRole("link", { name: "Im Telegram-Bot weiterüben", exact: true }).click();
    await page.evaluate(() => {
      for (let index = 0; index < 7; index++) window.dispatchEvent(new ErrorEvent("error", { message: "SYNTHETIC_PRIVATE_ERROR_TEXT", error: new Error("SYNTHETIC_PRIVATE_STACK") }));
    });
    await telegram();
    const events = await waitRows(events => events.filter(event => event.event_name === "frontend_error").length === 5);
    const start = events.filter(event => event.event_name === "quiz_started"), complete = events.filter(event => event.event_name === "quiz_completed");
    assert.equal(start.length, 1); assert.equal(complete.length, 1); assert.equal(start[0].metadata.quiz_run_id, complete[0].metadata.quiz_run_id);
    assert.equal(complete[0].metadata.answered_count, 5); assert(complete[0].metadata.correct_count <= 5);
    assert(events.filter(event => event.event_name === "frontend_error").every(event => event.metadata.error_code === "js_error" && event.metadata.component_id === "app"));
    await page.reload(); await ready(page); await telegram();
    assert.equal((await rows()).filter(event => event.event_name === "quiz_completed").length, 1);
  });
  await group("article read requires 60 real active seconds and coverage of opened material; footer alone fails", async () => {
    await page.goto(origin + "/wissen"); await ready(page);
    await page.locator("[data-analytics-id='article_deutsche-sprache-geschichte']").click(); await page.waitForURL("**/artikel/deutsche-sprache-geschichte");
    const started = Date.now();
    await page.locator("footer").last().scrollIntoViewIfNeeded();
    while (Date.now() - started < 61_000) { await page.keyboard.press("Shift"); await wait(5000); }
    await telegram(); let events = await rows(); assert.equal(events.filter(event => event.event_name === "article_read").length, 0);
    const closedHeaders = page.locator("[data-analytics-content] .era-card:not(.open) .era-card-header");
    while (await closedHeaders.count()) await closedHeaders.first().click();
    await page.evaluate(() => window.scrollTo(0, 0));
    let bottom = false;
    while (!bottom) {
      await page.mouse.wheel(0, 600); await wait(300);
      bottom = await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2);
    }
    await telegram(); events = await waitRows(events => events.some(event => event.event_name === "article_read"));
    const read = events.filter(event => event.event_name === "article_read"); assert.equal(read.length, 1);
    const engagement = events.filter(event => event.event_name === "engagement" && event.page_view_id === read[0].page_view_id);
    assert(engagement.some(event => event.metadata.active_ms >= 60_000));
    for (let i = 1; i < engagement.length; i++) assert(new Date(engagement[i].occurred_at) - new Date(engagement[i - 1].occurred_at) >= 30_000);
    const thresholds = events.filter(event => event.event_name === "scroll_depth" && event.page_view_id === read[0].page_view_id).map(event => event.metadata.threshold);
    assert.deepEqual([...thresholds].sort((a, b) => a - b), [25, 50, 75, 90]);
    await page.screenshot({ path: `${output}/article.png`, fullPage: true });
    return { elapsedRealMs: Date.now() - started, articleRead: 1, thresholds, engagementSamples: engagement.length };
  });
  await group("cross-tab revoke clears IDs/quiz state and stops actions; blocked storage preserves forms", async () => {
    const other = await main.newPage(); await other.goto(origin + "/contact"); await other.bringToFront(); await ready(other);
    await settings(other, "Einwilligung widerrufen");
    await page.waitForFunction(key => sessionStorage.getItem(key) === null, sessionKey);
    const count = analyticsRequests.length; await openForm("partner", other); await other.getByRole("button", { name: /Weiter/ }).click(); await wait(1500);
    assert.equal(analyticsRequests.length, count); assert.equal(await page.evaluate(() => sessionStorage.getItem("deutschmit_analytics_quiz_v2")), null);
    await other.close();
    const blocked = await context(true); const tab = await blocked.newPage(); await tab.goto(origin + "/contact"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click();
    await openForm("student", tab); await fillForm("student", "blocked-storage", tab); await submit("student", tab); await tab.getByText(`Danke, ${marker}-blocked-storage!`, { exact: true }).waitFor();
    assert.equal(latestContact.analytics, undefined); assert.equal(analyticsRequests.length, count); assert.equal((await contacts("blocked-storage")).length, 1);
    await blocked.close();
  });
  await group("all 15 event types read back through SQL and protected session API; no PII or legacy writes", async () => {
    const events = (await Promise.all([...visitors].map(visitor => rows(visitor)))).flat();
    const names = ["session_start", "page_view", "page_leave", "element_impression", "element_click", "scroll_depth", "engagement", "article_read", "quiz_started", "quiz_completed", "form_open", "form_submit", "form_success", "form_error", "frontend_error"];
    assert.deepEqual([...new Set(events.map(event => event.event_name))].sort(), names.sort());
    assert.equal(new Set(events.map(event => event.event_id)).size, events.length);
    for (const text of [JSON.stringify(events), JSON.stringify(analyticsRequests)]) {
      for (const forbidden of [privateText, privateContact, marker, "SYNTHETIC_PRIVATE_ERROR", "SYNTHETIC_PRIVATE_STACK", "private-fragment", "selected_answer_id", "lead_submit_success"]) assert(!text.includes(forbidden), `Forbidden analytics value: ${forbidden}`);
    }
    assert(analyticsRequests.every(request => request.endpoint === "/api/public/analytics/events"));
    assert.deepEqual(await site`SELECT to_jsonb(t) AS row FROM website_analytics_events t ORDER BY id`, beforeLegacy);
    const afterContacts = await site`SELECT to_jsonb(t) AS row FROM contact_requests t ORDER BY id`;
    for (const existing of beforeContacts) assert.deepEqual(afterContacts.find(item => item.row.id === existing.row.id), existing);
    const inserted = afterContacts.filter(item => !beforeContacts.some(old => old.row.id === item.row.id));
    assert.equal(inserted.length, 5);
    for (const item of inserted) { assert.equal(item.row.payload.analytics, undefined); assert.equal(item.row.payload.visitor_id, undefined); }
    const ctx = await context(); const tab = await ctx.newPage();
    const session = events.find(event => event.event_name === "form_success").session_id;
    assert.equal((await ctx.request.get(origin + `/api/admin/analytics/sessions/${session}`)).status(), 401);
    await tab.goto(origin + "/admin/login"); await tab.locator("#admin-email").fill("site@example.test"); await tab.locator("#admin-password").fill("synthetic-site-password");
    await tab.getByRole("button", { name: "Sign In", exact: true }).click(); await tab.waitForURL("**/admin/products");
    const response = await ctx.request.get(origin + `/api/admin/analytics/sessions/${session}`); assert.equal(response.status(), 200);
    assert.equal(response.headers()["cache-control"], "private, no-store"); const snapshot = await response.json();
    assert.deepEqual(snapshot.events.map(event => event.event_id).sort(), events.filter(event => event.session_id === session).map(event => event.event_id).sort());
    await ctx.close();
    writeFileSync(`${output}/sql-events.json`, JSON.stringify({ build: readFileSync(".verification/website-analytics/site/.next/BUILD_ID", "utf8").trim(), events }, null, 2));
    writeFileSync(`${output}/analytics-requests.json`, JSON.stringify(analyticsRequests, null, 2));
    return { eventTypes: 15, rows: events.length, contacts: inserted.length, oldContactsUnchanged: beforeContacts.length, legacyRowsUnchanged: beforeLegacy.length };
  });
} finally {
  for (const target of stopped) service("start", target);
  if (rejectingContact) await site`ALTER TABLE contact_requests DROP CONSTRAINT step4_reject_synthetic_contact`;
  await browser.close(); await sql.end(); await site.end();
}
