// Real browser -> Next gateway -> isolated FastAPI/PostgreSQL/Redis.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";
const production = process.argv.includes("--production");
const origin = process.argv.includes("--v1") ? "https://localhost:44453" : production ? "https://localhost:44443" : "http://localhost:43818";
const output = process.argv.includes("--v1") ? ".verification/website-analytics/v1/quiz-browser" : production ? ".verification/production-browser-evidence" : ".verification/browser-evidence";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: production, viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
await context.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const results = [];
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
async function step(name, fn) {
  try { await fn(); results.push({ name, result: "PASS" }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, result: "FAIL", error: error.message }); console.log(`FAIL: ${name}: ${error.message}`); }
}
async function api(path, method = "GET", body) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}
function totp() {
  const bits = [..."JBSWY3DPEHPK3PXP"].map(char => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  return String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000).padStart(6, "0");
}
let userId;
let promoId;
try {
  await page.goto(origin + "/admin/login");
  await step("unauthenticated server RBAC", async () => {
    for (const path of ["/api/admin/quiz-arena/users", "/api/admin/contact-requests", "/api/admin/website-analytics/overview"]) assert.equal((await api(path)).status, 401);
  });
  await step("site login in browser", async () => {
    await page.locator("#admin-email").fill("site@example.test");
    await page.locator("#admin-password").fill("synthetic-site-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/admin/products");
  });
  await step("independent site DB analytics", async () => {
    const response = await api("/api/admin/website-analytics/overview?days=7"); assert.equal(response.status, 200);
  });
  await step("backend login and real TOTP in browser", async () => {
    await page.goto(origin + "/admin/quiz-arena/login");
    await page.locator("#admin-email").fill("admin@example.com");
    await page.locator("#admin-password").fill("synthetic-backend-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.locator("#admin-2fa-code").waitFor();
    assert.equal((await api("/api/admin/quiz-arena/users")).status, 403);
    await page.locator("#admin-2fa-code").fill(totp());
    await page.getByRole("button", { name: "Verify 2FA", exact: true }).click();
    await page.waitForURL("**/admin/quiz-arena/dashboard");
  });
  for (const days of [7,30,90]) await step(`overview ${days}d API and rendered charts`, async () => {
    const wait = page.waitForResponse(r => r.url().includes(`/overview?period=${days}d`) && r.status() === 200);
    if (days === 7) await page.reload(); else await page.getByLabel("Zeitraum Quiz Arena").selectOption(`${days}d`);
    const response = await wait;
    const data = await response.json(); assert.equal(data.period, `${days}d`);
    await page.locator(".recharts-surface").first().waitFor();
    assert((await page.locator(".recharts-surface").count()) >= 3);
    await page.screenshot({ path: `${output}/overview-${days}.png`, fullPage: true });
    writeFileSync(`${output}/overview-${days}.json`, JSON.stringify(data, null, 2));
  });
  for (const [name, path] of [["users", "users"], ["content", "content"], ["purchases", "economy/purchases"], ["subscriptions", "economy/subscriptions"], ["cohorts", "economy/cohorts"], ["system", "system"], ["promos", "promo"], ["archive contacts", "contact-requests"]]) await step(`real API ${name}`, async () => {
    const response = await api(`/api/admin/quiz-arena/${path}`); assert.equal(response.status, 200);
    writeFileSync(`${output}/api-${name.replaceAll(" ", "-")}.json`, JSON.stringify(response.body, null, 2));
    if (name === "users") { userId = response.body.items[0]?.id; assert(userId); }
  });
  await step("users search, sorting and pagination", async () => {
    for (const sort of ["created_at", "daily_challenge_rating"]) {
      const response = await api(`/api/admin/quiz-arena/users?sort_by=${sort}&limit=1&page=1`); assert.equal(response.status, 200); assert.equal(response.body.items.length, 1);
      const next = await api(`/api/admin/quiz-arena/users?sort_by=${sort}&limit=1&page=2`); assert.notEqual(next.body.items[0].id, response.body.items[0].id);
    }
    const found = await api(`/api/admin/quiz-arena/users?search=${userId}`); assert(found.body.items.some(row => row.id === userId));
  });
  await step("user bonus/block/unblock/reset persisted readbacks", async () => {
    assert(userId);
    const path = `/api/admin/quiz-arena/users/${userId}`;
    for (const [action, body, status] of [["block", {reason:"Synthetic acceptance"}, "BLOCKED"], ["unblock", undefined, "ACTIVE"]]) {
      assert.equal((await api(`${path}/${action}`, "POST", body)).status, 200);
      assert.equal((await api(path)).body.info.status, status);
    }
    const before = (await api(path)).body.progress.paid_energy;
    for (const type of ["energy", "streak_token", "premium_days"]) assert.equal((await api(`${path}/bonus`, "POST", {type,amount:3})).status, 200);
    assert.equal((await api(path)).body.progress.paid_energy, before + 3);
    assert.equal((await api(`${path}/reset_state`, "POST")).status, 200);
    assert.equal((await api(path)).body.progress.paid_energy, 0);
  });
  await step("promo create/edit/toggle/reveal/stats/audit/revoke", async () => {
    const created = await api("/api/admin/quiz-arena/promo", "POST", {code:`ACCEPT${Date.now()}`,campaign_name:"Synthetic acceptance",discount_type:"PERCENT",discount_value:25,applicable_products:["PREMIUM_MONTH"],max_total_uses:10,max_per_user:1});
    assert.equal(created.status, 200); promoId = created.body.id; assert(promoId);
    const path = `/api/admin/quiz-arena/promo/${promoId}`;
    assert.equal((await api(path, "PATCH", {campaign_name:"Verified persisted campaign"})).status, 200);
    assert.equal((await api(path)).body.campaign_name, "Verified persisted campaign");
    assert.equal((await api(`${path}/toggle`, "PATCH")).status, 200);
    assert.equal((await api(path)).body.status, "inactive");
    assert.equal((await api(`${path}/toggle`, "PATCH")).status, 200);
    assert.equal((await api(`${path}/reveal`, "POST")).status, 200);
    assert.equal((await api(`${path}?reveal=true`)).status, 405);
    for (const tab of ["stats", "audit"]) assert.equal((await api(`${path}/${tab}`)).status, 200);
    assert.equal((await api(`${path}/revoke`, "POST")).status, 200);
    assert.equal((await api(path)).body.status, "active"); // revoke affects reservations, not code availability
  });
  for (const route of ["users", "content", "economy", "promo", "system"]) await step(`browser ${route} desktop/mobile`, async () => {
    await page.goto(`${origin}/admin/quiz-arena/${route}`);
    await page.locator("h1").last().waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${output}/${route}-desktop.png`, fullPage: true });
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({ path: `${output}/${route}-mobile.png`, fullPage: true });
    const width = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert(width.scroll <= width.client + 2, JSON.stringify(width));
    await page.setViewportSize({width:1440,height:1000});
  });
  await step("backend session refresh", async () => { assert.equal((await api("/api/admin/quiz-arena/auth/refresh", "POST")).status, 200); assert.equal((await api("/api/admin/quiz-arena/auth/session")).status, 200); });
  await step("no browser JavaScript exceptions", async () => assert.deepEqual(pageErrors, []));
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify({ results, pageErrors }, null, 2));
  await browser.close();
}
if (results.some(row => row.result === "FAIL")) process.exitCode = 1;
