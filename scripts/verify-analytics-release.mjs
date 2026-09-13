// Production image smoke test with synthetic auth and intercepted analytics writes.
// Requires local Docker and the existing acceptance Playwright installation.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "../.verification/browser/node_modules/playwright/index.mjs";

const output = resolve(".verification/analytics-release");
mkdirSync(output, { recursive: true });
const runId = `analytics-release-${Date.now()}`;
const requestedMode = process.argv.find(value => value.startsWith("--mode="))?.split("=")[1];
if (requestedMode && !["off", "new", "legacy"].includes(requestedMode)) throw new Error("Unknown mode");
const modes = requestedMode ? [requestedMode] : ["off", "new", "legacy"];
const reuseImages = process.argv.includes("--reuse-images");
const results = reuseImages && requestedMode
  ? JSON.parse(readFileSync(resolve(output, "results.json"), "utf8")).results.filter(result => result.mode !== requestedMode)
  : [];
const v2 = "/api/public/analytics/events";
const legacy = "/api/public/website-analytics/events";
const consentKeys = ["deutschmit_analytics_consent_v2", "quiz_arena_public_analytics_consent_v1"];
const imagePrefix = "deutschmit-analytics-release";

function docker(args, logName) {
  return new Promise((resolveCommand, reject) => {
    const log = logName ? createWriteStream(resolve(output, logName)) : null;
    let stdout = "", stderr = "";
    const child = spawn("docker", ["--config", resolve(".docker-test-config"), ...args], { windowsHide: true });
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Docker command timed out: ${args[0]}`)); }, 900_000);
    child.stdout.on("data", chunk => { if (log) log.write(chunk); else stdout += chunk; });
    child.stderr.on("data", chunk => { if (log) log.write(chunk); else stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      clearTimeout(timeout); log?.end();
      if (code !== 0) reject(new Error(`Docker ${args[0]} exited ${code}; ${logName ?? stderr.slice(-1200)}`));
      else resolveCommand(stdout.trim());
    });
  });
}

async function checkImage(mode, browser) {
  const tag = `${imagePrefix}:${mode}`;
  const name = `${runId}-${mode}`;
  await docker(["run", "--detach", "--rm", "--name", name, "--network", runId,
    "--publish", "127.0.0.1::3000", "--env", "SITE_ADMIN_EMAIL=site@example.test",
    "--env", "SITE_ADMIN_PASSWORD=synthetic-site-password",
    "--env", "SITE_ADMIN_SESSION_SECRET=synthetic-release-signing-key-at-least-32-bytes",
    // Deliberately disagree with the build argument: runtime env cannot switch browser tracking.
    "--env", `NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=${mode === "off" ? "new" : "off"}`, tag]);
  try {
    const port = (await docker(["port", name, "3000/tcp"])).split(":").at(-1);
    const origin = `http://localhost:${port}`;
    const ctx = await browser.newContext();
    const events = [], errors = [];
    await ctx.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if ([v2, legacy].includes(url.pathname)) {
        events.push({ endpoint: url.pathname, body: route.request().postDataJSON() });
        return route.fulfill({ status: 202, contentType: "application/json", body: "{\"ok\":true,\"accepted\":1}" });
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(20_000);
    let healthy = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { healthy = (await ctx.request.get(`${origin}/admin/login`, { timeout: 2000 })).ok(); } catch { /* Startup only. */ }
      if (healthy) break;
      await delay(500);
    }
    assert(healthy, `${mode}: login health`);
    for (const report of ["overview", "sessions", "pages", "events", "traffic", "conversions"]) {
      const response = await ctx.request.get(`${origin}/api/admin/analytics/deutschmit/${report}`);
      assert.equal(response.status(), 401, `${mode}: unauthenticated ${report}`);
    }
    await page.goto(origin);
    await page.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).waitFor();
    if (mode === "off") {
      // Persisted grants from either producer must not reactivate an off image.
      await page.evaluate(keys => keys.forEach(key => localStorage.setItem(key, "granted")), consentKeys);
      await page.reload();
      await delay(1500);
      assert.equal(await page.getByRole("dialog", { name: "Datenschutz und Analytics-Einwilligung" }).count(), 0);
      assert.equal(events.length, 0);
    } else {
      await page.getByRole("button", { name: "Analytics ablehnen", exact: true }).click();
      await delay(500);
      assert.equal(events.length, 0, `${mode}: pending/deny`);
      await page.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).click();
      const expected = mode === "new" ? v2 : legacy;
      const delivered = page.waitForResponse(response => new URL(response.url()).pathname === expected);
      await page.getByRole("button", { name: "Analytics erlauben", exact: true }).click();
      await delivered;
      const viewed = page.waitForResponse(response => new URL(response.url()).pathname === expected);
      await page.goto(`${origin}/wissen`);
      await viewed;
      assert(events.length >= 2);
      assert(events.every(event => event.endpoint === expected), `${mode}: producer isolation`);
      assert(events.some(event => mode === "new"
        ? event.body.events?.some(item => item.event_name === "page_view")
        : event.body.event_type === "page_view"), `${mode}: real page view payload`);
      await page.getByRole("button", { name: "Analytics-Einstellungen", exact: true }).click();
      await page.getByRole("button", { name: "Einwilligung widerrufen", exact: true }).click();
      await delay(500);
      const afterRevoke = events.length;
      await page.reload();
      await delay(1500);
      assert.equal(events.length, afterRevoke, `${mode}: revoke survives reload`);
    }
    assert.deepEqual(errors, [], `${mode}: browser errors`);
    const label = await docker(["image", "inspect", tag, "--format", '{{ index .Config.Labels "de.deutschmit.analytics-mode" }}']);
    assert.equal(label, mode);
    const imageId = await docker(["image", "inspect", tag, "--format", "{{.Id}}"]);
    results.push({ mode, tag, imageId, status: "PASS", protectedReports: 6, analyticsRequests: events.length, runtimeOverrideIgnored: true });
    await ctx.close();
    console.log(`PASS: ${mode} production image, consent/routing, health, 6 private APIs`);
  } finally { await docker(["stop", name]); }
}

let browser, networkCreated = false;
try {
  for (const mode of reuseImages ? [] : modes) {
    console.log(`BUILD: ${mode} production image`);
    await docker(["build", "--target", "production", "--tag", `${imagePrefix}:${mode}`,
      "--build-arg", `NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=${mode}`,
      "--build-arg", "NEXT_PUBLIC_SITE_URL=https://example.test",
      "--build-arg", "NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/synthetic_test_bot",
      "."], `build-${mode}.log`);
  }
  // Docker suppresses published ports on an internal network. This dedicated
  // bridge exposes only a loopback port; no production URLs/credentials are set.
  await docker(["network", "create", "--driver", "bridge", runId]); networkCreated = true;
  browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const mode of modes) await checkImage(mode, browser);
  console.log(`PASS: ${results.length}/3 production image modes; ${results.length * 6}/18 private API checks`);
} finally {
  await browser?.close();
  if (networkCreated) await docker(["network", "rm", runId]);
  writeFileSync(resolve(output, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
}
