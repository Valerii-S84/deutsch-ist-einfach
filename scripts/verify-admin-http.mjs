// Isolated HTTP smoke: synthetic credentials/data, no production DB or backend.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sitePort = 43817;
const origin = `http://localhost:${sitePort}`;
let backendCalls = 0;
let promoActive = true;
const backend = createServer((request, response) => {
  backendCalls++;
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/admin/auth/login") {
    response.setHeader("Set-Cookie", ["qa_admin_access=synthetic-access; HttpOnly; Path=/", "qa_admin_refresh=synthetic-refresh; HttpOnly; Path=/"]);
    response.end('{"requires_2fa":false}'); return;
  }
  if (!(request.headers.cookie ?? "").includes("qa_admin_access=synthetic-access")) { response.statusCode = 401; response.end('{}'); return; }
  if (request.url === "/admin/promo/9223372036854775807/toggle") {
    promoActive = !promoActive;
    response.end(`{"id":9223372036854775807,"status":"${promoActive ? "active" : "inactive"}"}`); return;
  }
  if (request.url === "/admin/promo/9223372036854775807") {
    response.end(`{"id":9223372036854775807,"status":"${promoActive ? "active" : "inactive"}"}`); return;
  }
  response.end('{"items":[],"total":0,"page":1,"pages":1}');
});
await new Promise(resolve => backend.listen(0, "127.0.0.1", resolve));
const backendPort = backend.address().port;
const env = { ...process.env, NODE_ENV: "development", DATABASE_URL: "", SITE_ADMIN_EMAIL: "synthetic@example.test", SITE_ADMIN_PASSWORD: "synthetic-password-43817", SITE_ADMIN_SESSION_SECRET: "synthetic-session-signing-key-at-least-32-bytes", QUIZ_ARENA_ADMIN_URL: `http://127.0.0.1:${backendPort}`, API_INTERNAL_URL: "", NEXT_PUBLIC_API_URL: "", QUIZ_BANK_API_BASE_URL: "", QUIZ_BANK_EDGE_API_KEY: "", QUIZ_BANK_CONSUMER_ID: "", QUIZ_BANK_CONSUMER_API_KEY: "", NEXT_PUBLIC_SITE_URL: origin, NEXT_TELEMETRY_DISABLED: "1" };
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", String(sitePort), "--hostname", "127.0.0.1"], { cwd: root, env, windowsHide: true, stdio: "ignore" });
let checks = 0;
let cookie = "";
function cookieUpdate(response) {
  const current = new Map(cookie.split("; ").filter(Boolean).map(pair => { const at = pair.indexOf("="); return [pair.slice(0, at), pair.slice(at + 1)]; }));
  for (const header of response.headers.getSetCookie()) { const pair = header.split(";", 1)[0]; const at = pair.indexOf("="); current.set(pair.slice(0, at), pair.slice(at + 1)); }
  cookie = [...current].map(([key, value]) => `${key}=${value}`).join("; ");
}
async function call(path, method = "GET", body, auth = true, requestOrigin = origin) {
  return fetch(origin + path, { method, redirect: "manual", signal: AbortSignal.timeout(60_000), headers: { ...(auth ? { Cookie: cookie } : {}), Origin: requestOrigin, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
function check(actual, expected) { assert.deepEqual(actual, expected); checks++; }
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error("Isolated Next dev process exited");
    try { const response = await fetch(origin + "/admin/login", { signal: AbortSignal.timeout(3000) }); if (response.ok) { ready = true; break; } } catch {}
    await delay(1000);
  }
  assert(ready, "Isolated Next did not become ready");
  check((await call("/api/admin/quiz-arena/users", "GET", undefined, false)).status, 401);
  check(backendCalls, 0);
  const login = await call("/api/admin/login", "POST", { email: env.SITE_ADMIN_EMAIL, password: env.SITE_ADMIN_PASSWORD });
  check(login.status, 200); cookieUpdate(login); check(backendCalls, 0);
  for (const path of ["/admin/quiz-arena/dashboard", "/admin/deutschmit", "/admin/deutsch-trainer", "/admin/shorts-blocker-kids", "/admin/deutschmit/requests"]) check((await call(path)).status, 200);
  const botLogin = await call("/api/admin/quiz-arena/auth/login", "POST", { email: "bot@example.test", password: "synthetic-bot-password" });
  check(botLogin.status, 200); cookieUpdate(botLogin);
  const mutation = await call("/api/admin/quiz-arena/promo/9223372036854775807/toggle", "PATCH");
  check(mutation.status, 200); check(await mutation.json(), { id: "9223372036854775807", status: "inactive" });
  const readBack = await call("/api/admin/quiz-arena/promo/9223372036854775807");
  check(await readBack.json(), { id: "9223372036854775807", status: "inactive" });
  const beforeCsrf = backendCalls;
  check((await call("/api/admin/quiz-arena/promo/9223372036854775807/toggle", "PATCH", undefined, true, "https://foreign.example.test")).status, 403);
  check(backendCalls, beforeCsrf);
  await new Promise(resolve => backend.close(resolve));
  check((await call("/api/admin/quiz-arena/users")).status, 503);
  check((await call("/")).status, 200);
  check((await call("/admin/deutsch-trainer")).status, 200);
  check((await call("/api/admin/website-analytics/overview")).status, 503); // no site DB configured, not a bot failure
  check((await call("/api/admin/contact-requests")).status, 503);
  console.log(`PASS: ${checks} isolated HTTP controls; site login, product routes, bigint mutation/readback, CSRF, bot outage; no real data`);
} finally {
  if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else child.kill();
  if (backend.listening) await new Promise(resolve => backend.close(resolve));
}
