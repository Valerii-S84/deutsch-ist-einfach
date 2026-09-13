// Targeted browser regression of the real legacy client; no Next build or DB writes.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";

const output = ".verification/website-analytics/step-3-legacy-browser";
mkdirSync(output, { recursive: true });
const bundle = await rolldown({ input: resolve("lib/public-analytics-client.ts"), platform: "browser", resolve: { alias: { "@": resolve(".") } } });
const generated = await bundle.generate({ format: "iife", name: "LegacyAnalytics" });
await bundle.close();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext();
const results = [], errors = [];
// A synthetic localhost document exercises actual browser storage, UUIDs and clock.
await context.route("**/*", route => route.request().url() === "http://localhost/"
  ? route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Legacy ID regression</title>" }) : route.abort());
const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto("http://localhost/");
  await page.addScriptTag({ content: generated.output[0].code });
  const evidence = await page.evaluate(() => {
    const idKey = "quiz_arena_public_visitor_id_v1", ageKey = "quiz_arena_public_visitor_age_v1", consentKey = "quiz_arena_public_analytics_consent_v1";
    const getId = () => window.LegacyAnalytics.getOrCreatePublicVisitorId();
    const realNow = Date.now;
    const created = realNow();
    try {
      Date.now = () => created;
      const pending = getId();
      const noIdsBeforeGrant = localStorage.getItem(idKey) === null && localStorage.getItem(ageKey) === null;
      localStorage.setItem(consentKey, "granted");
      const first = getId();
      Date.now = () => created + 90 * 86_400_000 - 1;
      const beforeExpiry = getId();
      const originalCreated = JSON.parse(localStorage.getItem(ageKey)).created;
      Date.now = () => created + 91 * 86_400_000;
      const afterExpiry = getId();
      const repeated = getId();
      localStorage.removeItem(ageKey);
      const unknownAge = getId();
      localStorage.setItem(consentKey, "denied");
      const denied = getId();
      return { pending, noIdsBeforeGrant, first, beforeExpiry, created, originalCreated, afterExpiry, repeated, unknownAge, denied };
    } finally { Date.now = realNow; }
  });
  assert.equal(evidence.pending, null); assert.equal(evidence.denied, null); assert(evidence.noIdsBeforeGrant);
  results.push({ name: "no ID or age before consent; denied access returns no ID", status: "PASS" });
  assert(evidence.first); assert.equal(evidence.beforeExpiry, evidence.first); assert.equal(evidence.originalCreated, evidence.created);
  assert.notEqual(evidence.afterExpiry, evidence.first); assert.equal(evidence.repeated, evidence.afterExpiry);
  results.push({ name: "ID survives until 90 days and rotates at 91 days without extending age", status: "PASS", evidence });
  assert.notEqual(evidence.unknownAge, evidence.afterExpiry); assert.deepEqual(errors, []);
  results.push({ name: "existing unknown-age ID rotates on first use; no browser errors", status: "PASS" });
  console.log(`PASS: ${results.length}/${results.length} targeted legacy browser groups`);
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify({ generated_at: new Date().toISOString(), browser: browser.version(), results, errors }, null, 2));
  await browser.close();
}
