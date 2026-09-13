// Step 3: real browser producers -> local HTTPS Next production -> isolated PostgreSQL.
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import postgres from "postgres";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";

const origin = "https://localhost:44453";
const output = ".verification/website-analytics/step-3-browser";
mkdirSync(output, { recursive: true });
const consentKey = "deutschmit_analytics_consent_v2", visitorKey = "deutschmit_analytics_visitor_v2", sessionKey = "deutschmit_analytics_session_v2";
const sql = postgres("postgresql://analytics_user:synthetic-analytics-only@127.0.0.1:45442/deutschmit_analytics", { connect_timeout: 3 });
const site = postgres("postgresql://site_test:synthetic-site-only@127.0.0.1:45443/site_analytics_acceptance", { connect_timeout: 3 });
const browser = await chromium.launch({ channel: "msedge", headless: true, ignoreDefaultArgs: ["--disable-back-forward-cache"], args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] });
const results = [], requests = [], pageErrors = [];
const snapshotSite = async () => (await site`SELECT 'contacts' AS source, coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]'::jsonb) AS rows FROM contact_requests t UNION ALL SELECT 'legacy', coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]'::jsonb) FROM website_analytics_events t`);
const beforeSite = await snapshotSite();
let outage = false;
async function group(name, fn) {
  try { const evidence = await fn(); results.push({ name, status: "PASS", evidence }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, status: "FAIL", error: error.message }); throw error; }
  finally { writeFileSync(`${output}/results.json`, JSON.stringify({ generated_at: new Date().toISOString(), browser: browser.version(), results }, null, 2)); }
}
async function context({ routing = true, storageBlocked = false } = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
  if (routing) await ctx.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
  await ctx.addInitScript(({ storageBlocked }) => {
    if (storageBlocked) for (const method of ["getItem", "setItem", "removeItem"]) Storage.prototype[method] = () => { throw new DOMException("test storage denied", "SecurityError"); };
    // Preserve actual click handlers while preventing navigation to real external products.
    document.addEventListener("click", event => { const anchor = event.target.closest?.("a"); if (anchor && /^https?:/.test(anchor.href) && new URL(anchor.href).origin !== location.origin) event.preventDefault(); }, true);
    window.__acceptanceRestored = 0;
    window.addEventListener("pageshow", event => { if (event.persisted) window.__acceptanceRestored++; });
  }, { storageBlocked });
  ctx.on("page", page => {
    page.setDefaultTimeout(20_000); page.on("pageerror", error => pageErrors.push({ message: error.message, stack: error.stack, url: page.url() }));
    page.on("request", request => { if (request.url().includes("/api/public/") && request.url().includes("analytics")) requests.push({ url: request.url(), body: request.postDataJSON() }); });
  });
  return ctx;
}
async function ids(page) { return page.evaluate(({ visitorKey, sessionKey }) => ({ visitor: JSON.parse(localStorage.getItem(visitorKey)), session: JSON.parse(sessionStorage.getItem(sessionKey)) }), { visitorKey, sessionKey }); }
async function ready(page) { await page.waitForFunction(key => JSON.parse(sessionStorage.getItem(key))?.sequence >= 2, sessionKey); return ids(page); }
async function telegram(page) { await page.locator("header a[href*='t.me']:visible").first().click(); }
async function settings(page, decision) { await page.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).click(); await page.getByRole("button", { name: decision, exact: true }).click(); }
// Keep the step-3 lifecycle checks focused on their original events. Step 4 also emits
// impressions, engagement and internal-link clicks; verify-analytics-actions covers them.
async function rows(visitor) {
  const events = await sql`SELECT * FROM analytics_events WHERE product_id='deutschmit' AND visitor_id=${visitor} ORDER BY occurred_at, sequence, event_id`;
  return events.filter(event => ["session_start", "page_view", "page_leave"].includes(event.event_name) || (event.event_name === "element_click" && event.metadata.destination === "telegram"));
}
async function waitRows(visitor, predicate) {
  const deadline = Date.now() + 20_000;
  do { const result = await rows(visitor); if (predicate(result)) return result; await new Promise(resolve => setTimeout(resolve, 150)); } while (Date.now() < deadline);
  throw new Error("Expected browser events did not reach isolated PostgreSQL");
}
function analyticsService(action) {
  assert(["start", "stop"].includes(action));
  const result = spawnSync("docker", ["--config", resolve(".docker-test-config"), action, "website-analytics-acceptance-analytics-1"], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  assert.equal(result.status, 0, "Synthetic analytics service operation failed");
}
let main, page, visitor, originalSession;
try {
  await group("pending and denied: no requests, IDs or replay; permanent footer controls", async () => {
    main = await context(); page = await main.newPage(); await page.goto(origin + "/?utm_source=Instagram&utm_medium=Paid%20Social&utm_campaign=Herbst%20Kurs%202026#private");
    await page.getByRole("button", { name: "Analytics erlauben", exact: true }).waitFor();
    await telegram(page); assert.deepEqual(await ids(page), { visitor: null, session: null }); assert.equal(requests.length, 0);
    await page.getByRole("button", { name: "Analytics ablehnen", exact: true }).click();
    await telegram(page); assert.equal(requests.length, 0); assert.deepEqual(await ids(page), { visitor: null, session: null });
    await settings(page, "Analytics erlauben"); const identity = await ready(page); visitor = identity.visitor.id; originalSession = identity.session.id;
    await telegram(page); const saved = await waitRows(visitor, events => events.some(event => event.event_name === "element_click"));
    assert.deepEqual(saved.map(event => event.event_name), ["session_start", "page_view", "element_click"]);
    assert.equal(new Set(saved.map(event => event.session_id)).size, 1);
    for (const event of saved) { assert.equal(event.metadata.utm_campaign, "Herbst-Kurs-2026"); assert.equal(event.metadata.utm_source, "instagram"); assert.equal(event.path, "/"); }
    assert(!JSON.stringify(saved).includes("private")); return { visitor, session: originalSession, rows: saved.length };
  });
  await group("SPA, back/forward, reload: new views, one tab session, stable entry attribution", async () => {
    await page.locator("a[href='/wissen']:visible").first().click(); await page.waitForURL("**/wissen"); await telegram(page);
    await page.goBack(); await telegram(page); await page.goForward(); await telegram(page);
    await page.reload(); await ready(page); await telegram(page);
    const saved = await waitRows(visitor, events => events.filter(event => event.event_name === "page_view").length === 5);
    assert.equal(new Set(saved.map(event => event.session_id)).size, 1); assert.equal(saved.filter(event => event.event_name === "session_start").length, 1);
    const views = saved.filter(event => event.event_name === "page_view");
    assert.deepEqual(views.map(event => event.path), ["/", "/wissen", "/", "/wissen", "/wissen"]);
    assert.equal(new Set(views.map(event => event.page_view_id)).size, views.length);
    assert.equal(new Set(saved.map(event => event.sequence)).size, saved.length);
    assert(saved.every(event => event.metadata.utm_campaign === "Herbst-Kurs-2026"));
    return { views: views.length, sessions: 1, leaves: saved.filter(event => event.event_name === "page_leave").length };
  });
  await group("hidden/focus/hash/prefetch do not duplicate a view", async () => {
    const previous = (await rows(visitor)).filter(event => event.event_name === "page_view").length;
    await page.evaluate(() => { location.hash = "another-section"; });
    const other = await main.newPage(); await other.goto("about:blank"); await other.bringToFront(); await page.bringToFront(); await other.close();
    await page.locator("footer a[href='/projects']").hover(); await telegram(page);
    const saved = await rows(visitor); assert.equal(saved.filter(event => event.event_name === "page_view").length, previous);
  });
  await group("new and cloned tabs share visitor but have distinct sessions; cross-tab revoke and regrant", async () => {
    const next = await main.newPage(); await next.goto(origin + "/contact"); await next.bringToFront(); const newIds = await ready(next);
    assert.equal(newIds.visitor.id, visitor); assert.notEqual(newIds.session.id, originalSession);
    // window.open copies the opener's sessionStorage, exercising the duplicate-tab collision.
    const popupPromise = main.waitForEvent("page"); await page.evaluate(() => window.open("/wissen", "_blank")); const cloned = await popupPromise;
    await cloned.waitForLoadState(); await cloned.bringToFront(); const clonedIds = await ready(cloned);
    assert.equal(clonedIds.visitor.id, visitor); assert(![originalSession, newIds.session.id].includes(clonedIds.session.id));
    await cloned.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).click();
    await cloned.getByRole("button", { name: "Einwilligung widerrufen", exact: true }).click();
    for (const tab of [page, next, cloned]) await tab.waitForFunction(key => sessionStorage.getItem(key) === null, sessionKey);
    const requestCount = requests.length; await telegram(cloned); await new Promise(resolve => setTimeout(resolve, 1100)); assert.equal(requests.length, requestCount);
    await settings(cloned, "Analytics erlauben"); const regrant = await ready(cloned); assert.notEqual(regrant.visitor.id, visitor);
    await telegram(cloned); await waitRows(regrant.visitor.id, events => events.some(event => event.event_name === "element_click"));
    await next.close(); await cloned.close(); await main.close();
    return { originalSession, newTab: newIds.session.id, clonedTab: clonedIds.session.id, newVisitor: regrant.visitor.id };
  });
  await group("retry after lost acknowledgement commits once with the same event IDs", async () => {
    const ctx = await context(); const tab = await ctx.newPage(); let lost = false; const bodies = [];
    await tab.route("**/api/public/analytics/events", async route => {
      bodies.push(route.request().postData());
      if (!lost) { lost = true; const committed = await route.fetch(); assert.equal(committed.status(), 200); await route.fulfill({ status: 503, body: "{}", contentType: "application/json" }); }
      else await route.continue();
    });
    await tab.goto(origin + "/"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click(); const identity = await ready(tab); await telegram(tab);
    const originalIds = JSON.parse(bodies[0]).events.map(event => event.event_id);
    await tab.waitForResponse(response => response.url().endsWith("/api/public/analytics/events") && response.status() === 200 && response.request().postDataJSON().events.some(event => event.event_id === originalIds[0]));
    const sent = bodies.flatMap(body => JSON.parse(body).events);
    for (const id of originalIds) assert.equal(sent.filter(event => event.event_id === id).length, 2);
    const committed = await sql`SELECT event_id FROM analytics_events WHERE visitor_id=${identity.visitor.id}`;
    for (const id of originalIds) assert.equal(committed.filter(event => event.event_id === id).length, 1);
    const saved = await rows(identity.visitor.id); assert.equal(saved.length, 3);
    await ctx.close(); return { requests: bodies.length, lifecycleRows: saved.length, retriedIds: originalIds.length, rowPerRetriedId: 1 };
  });
  await group("cloned tab after Admin navigation and released lock starts its own session", async () => {
    const ctx = await context(); const tab = await ctx.newPage();
    await tab.goto(origin + "/privacy"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click();
    const first = await ready(tab); await telegram(tab); await waitRows(first.visitor.id, events => events.length === 3);
    await tab.goto(origin + "/admin/login");
    assert.equal((await ids(tab)).session.id, first.session.id, "Admin document must retain the copied-state precondition");
    const free = await tab.evaluate(id => navigator.locks.request(`deutschmit-analytics-session-${id}`, { ifAvailable: true }, lock => !!lock), first.session.id);
    assert.equal(free, true, "Opener's session lock must actually be free before cloning");
    await ctx.addInitScript(key => {
      // Chromium runs this on provisional about:blank too. An inherited origin has
      // copied storage there; an opaque document throws. The assertion below still
      // requires a successful pre-hydration capture for the actual cloned tab.
      try { window.__copiedSessionBeforeHydration = JSON.parse(sessionStorage.getItem(key)); } catch {}
    }, sessionKey);
    const popupPromise = ctx.waitForEvent("page"); await tab.evaluate(() => window.open("/wissen", "_blank"));
    const popup = await popupPromise; await popup.waitForLoadState(); await popup.bringToFront(); const next = await ready(popup);
    assert.equal(await popup.evaluate(() => window.__copiedSessionBeforeHydration.id), first.session.id);
    assert.equal(next.visitor.id, first.visitor.id); assert.notEqual(next.session.id, first.session.id);
    await telegram(popup);
    const saved = await waitRows(first.visitor.id, events => events.some(event => event.session_id === next.session.id && event.event_name === "element_click"));
    const popupEvents = saved.filter(event => event.session_id === next.session.id);
    assert.deepEqual(popupEvents.map(event => event.event_name), ["session_start", "page_view", "element_click"]);
    assert.deepEqual(popupEvents.slice(0, 2).map(event => event.sequence), [1, 2]);
    assert(popupEvents[2].sequence > 2); // New observations may occupy intermediate sequence numbers.
    assert(popupEvents.every(event => event.path === "/wissen" && event.metadata.entry_path === "/wissen"));
    await popup.reload(); await ready(popup); await telegram(popup);
    assert.equal((await ids(popup)).session.id, next.session.id, "Reload of an opened tab must preserve its new session");
    await ctx.close(); return { lockFreeBeforeClone: free, copiedSession: first.session.id, newSession: next.session.id, popupSequence: popupEvents.map(event => event.sequence), reloadPreserved: true };
  });
  await group("offline recovery preserves IDs and does not block SPA navigation", async () => {
    const ctx = await context(); const tab = await ctx.newPage(); await tab.goto(origin + "/"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click(); const identity = await ready(tab);
    await ctx.setOffline(true); await telegram(tab); await ctx.setOffline(false);
    await waitRows(identity.visitor.id, events => events.some(event => event.event_name === "element_click"));
    await tab.locator("a[href='/wissen']:visible").first().click(); await tab.waitForURL("**/wissen"); await telegram(tab);
    const saved = await waitRows(identity.visitor.id, events => events.filter(event => event.event_name === "page_view").length === 2);
    assert.equal(new Set(saved.map(event => event.session_id)).size, 1); await ctx.close();
  });
  await group("blocked local/session storage: consent, navigation and Telegram remain usable with no collection", async () => {
    const before = requests.length; const ctx = await context({ storageBlocked: true }); const tab = await ctx.newPage();
    await tab.goto(origin + "/"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click(); await telegram(tab);
    await tab.locator("a[href='/wissen']:visible").first().click(); await tab.waitForURL("**/wissen"); await telegram(tab);
    await tab.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).click();
    assert.equal(requests.length, before); await ctx.close();
  });
  await group("30-minute persisted inactivity rotates session; visitor and page stay usable", async () => {
    const ctx = await context(); const tab = await ctx.newPage(); await tab.goto(origin + "/"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click();
    const first = await ready(tab); await telegram(tab); await waitRows(first.visitor.id, events => events.length === 3);
    // Age the synthetic persisted state after old-page pagehide saves it, before hydration.
    await tab.addInitScript(key => {
      try {
        const state = JSON.parse(sessionStorage.getItem(key));
        if (!state) return;
        state.lastActivity -= 30 * 60_000 + 1; sessionStorage.setItem(key, JSON.stringify(state));
      } catch { /* An opaque provisional document has no storage to age. */ }
    }, sessionKey);
    await tab.reload(); const next = await ready(tab); await telegram(tab);
    assert.equal(first.visitor.id, next.visitor.id); assert.notEqual(first.session.id, next.session.id);
    const saved = await waitRows(first.visitor.id, events => events.filter(event => event.event_name === "session_start").length === 2);
    assert.equal(saved.filter(event => event.event_name === "page_view").length, 2); await ctx.close();
  });
  await group("actual BFCache restore produces one fresh page view in the same session", async () => {
    const ctx = await context({ routing: false }); const tab = await ctx.newPage();
    await tab.goto(origin + "/privacy"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click(); const first = await ready(tab); await telegram(tab);
    await waitRows(first.visitor.id, events => events.length === 3);
    await tab.evaluate(() => { location.href = "/impressum"; }); await tab.waitForURL("**/impressum"); await ready(tab); await telegram(tab);
    // BFCache emits pageshow, not a new document load event.
    await tab.evaluate(() => { history.back(); }); await tab.waitForURL("**/privacy", { waitUntil: "commit" }); await ready(tab); await telegram(tab);
    const restored = await tab.evaluate(() => window.__acceptanceRestored); assert(restored > 0, "Browser did not use BFCache; do not label a normal reload as BFCache");
    const saved = await waitRows(first.visitor.id, events => events.filter(event => event.event_name === "page_view").length === 3);
    assert.equal(new Set(saved.map(event => event.session_id)).size, 1); assert.equal(saved.filter(event => event.event_name === "session_start").length, 1);
    await ctx.close(); return { persistedPageshow: restored, views: 3, sessions: 1 };
  });
  await group("actual Analytics outage: navigation, privacy settings and existing Admin remain available", async () => {
    analyticsService("stop"); outage = true;
    const ctx = await context(); const tab = await ctx.newPage(); await tab.goto(origin + "/"); await tab.getByRole("button", { name: "Analytics erlauben", exact: true }).click(); await ready(tab);
    const failed = tab.waitForResponse(response => response.url().endsWith("/api/public/analytics/events") && response.status() === 503); await telegram(tab); await failed;
    await tab.locator("a[href='/wissen']:visible").first().click(); await tab.waitForURL("**/wissen"); await settings(tab, "Einwilligung widerrufen");
    await tab.goto(origin + "/admin/login"); await tab.locator("#admin-email").fill("site@example.test"); await tab.locator("#admin-password").fill("synthetic-site-password"); await tab.getByRole("button", { name: "Sign In", exact: true }).click(); await tab.waitForURL("**/admin/products");
    await tab.goto(origin + "/admin/dashboard"); assert.equal(new URL(tab.url()).pathname, "/admin/dashboard");
    await ctx.close(); analyticsService("start"); outage = false;
  });
  await group("new producer leaves contacts/legacy untouched; no Admin payloads or browser exceptions", async () => {
    await main?.close();
    assert.deepEqual(await snapshotSite(), beforeSite);
    assert(requests.every(request => request.url.endsWith("/api/public/analytics/events")));
    // Chromium can omit the body of a pagehide beacon from the automation protocol.
    // Inspect available payloads and independently check all stored events for these visitors.
    const inspectable = requests.filter(request => request.body !== null);
    assert(inspectable.every(request => request.body.events.every(event => !event.path.startsWith("/admin"))));
    const visitorIds = [...new Set(inspectable.flatMap(request => request.body.events.map(event => event.visitor_id)))];
    assert(visitorIds.length > 0);
    const persisted = await sql`SELECT path FROM analytics_events WHERE visitor_id IN ${sql(visitorIds)}`;
    assert(persisted.every(event => !event.path.startsWith("/admin")));
    assert.deepEqual(pageErrors, []);
    writeFileSync(`${output}/requests.json`, JSON.stringify(requests, null, 2));
    return { requests: requests.length, protocolBodiesUnavailable: requests.length - inspectable.length, storedEventsChecked: persisted.length, unchangedSiteTables: 2, pageErrors: 0 };
  });
} finally {
  if (outage) analyticsService("start");
  await browser.close(); await sql.end(); await site.end();
}
