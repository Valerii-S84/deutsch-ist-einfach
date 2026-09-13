// Requires the isolated dev process from prepare-analytics-acceptance.mjs dev.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";

const production = process.argv.includes("--production");
const origin = production ? "https://localhost:44453" : "http://localhost:43828";
const output = ".verification/website-analytics";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: production });
await context.route("**/*", route => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort());
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS: ${name}`); }
try {
  await check("secure pages redirect anonymous users", async () => {
    for (const path of ["products", "dashboard", "deutschmit/requests", "quiz-arena/users"]) {
      await page.goto(`${origin}/admin/${path}`);
      assert.equal(new URL(page.url()).pathname, "/admin/login");
    }
  });
  await check("existing admin APIs reject anonymous users", async () => {
    for (const path of ["contact-requests", "website-analytics/overview", "quiz-arena/users"]) assert.equal((await context.request.get(`${origin}/api/admin/${path}`)).status(), 401);
  });
  await check("real login navigates to product picker with bot disabled", async () => {
    await page.locator("#admin-email").fill("site@example.test");
    await page.locator("#admin-password").fill("synthetic-site-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/admin/products");
    assert.equal(await page.locator("main a").count(), 4);
    assert.equal(await page.getByText("Джерело не підключено.", { exact: false }).count(), 2);
  });
  await check("picker opens every product and switches back", async () => {
    for (const path of ["/admin/quiz-arena/dashboard", "/admin/deutschmit", "/admin/deutsch-trainer", "/admin/shorts-blocker-kids"]) {
      await page.locator(`main a[href='${path}']`).click();
      await page.waitForURL(`**${path === "/admin/deutschmit" ? "/admin/deutschmit/overview" : path}`);
      await page.getByRole("link", { name: "Усі продукти", exact: true }).click();
      await page.waitForURL("**/admin/products");
    }
  });
  await check("website statistics, requests and legacy archive remain reachable", async () => {
    await page.goto(origin + "/admin/deutschmit");
    await page.locator("a[href='/admin/dashboard']").click();
    await page.waitForURL("**/admin/dashboard");
    await page.goto(origin + "/admin/deutschmit");
    await page.locator("a[href='/admin/deutschmit/requests']").click();
    await page.getByLabel("Джерело заявок").selectOption("legacy");
    await page.getByText("Архів потребує окремого входу", { exact: false }).waitFor();
  });
  await check("all Quiz Arena menus and separate login remain available", async () => {
    await page.goto(origin + "/admin/quiz-arena/login");
    for (const section of ["dashboard", "users", "content", "economy", "promo", "system", "login"]) assert.equal(await page.locator(`nav[aria-label='Quiz Arena Bot'] a[href='/admin/quiz-arena/${section}']`).count(), 1);
    assert.equal(await page.locator("#admin-email").count(), 1);
  });
  await check("unknown product returns HTTP 404; /admin leads to picker", async () => {
    assert.equal((await context.request.get(origin + "/admin/not-a-product")).status(), 404);
    await page.goto(origin + "/admin");
    assert.equal(new URL(page.url()).pathname, "/admin/products");
  });
  await page.screenshot({ path: `${output}/product-picker.png`, fullPage: true });
  writeFileSync(`${output}/product-picker-results.json`, JSON.stringify({ checks, passed: checks.length, backend: "disabled", data: "synthetic only" }, null, 2));
} finally { await browser.close(); }
