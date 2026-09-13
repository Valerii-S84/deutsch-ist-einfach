// Synthetic upgrade/retention acceptance check. Never reads the deployment .env.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const output = resolve(".verification/review22-upgrade");
mkdirSync(output, { recursive: true });
const configPath = process.argv[2];
if (!configPath) throw new Error("Pass an isolated Docker configuration directory");
const name = "review22-upgrade-" + Date.now();
const password = "synthetic-upgrade-password";
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA)$/i.test(key)));
const env = { ...baseEnv, POSTGRES_PASSWORD: password, ANALYTICS_DB_PASSWORD: password,
  SITE_ADMIN_EMAIL: "test@example.test", SITE_ADMIN_PASSWORD: "synthetic-owner-password",
  SITE_ADMIN_SESSION_SECRET: "synthetic-session-key-with-at-least-32-bytes",
  ANALYTICS_SERVICE_KEY: "synthetic-service-key-with-at-least-32-bytes" };
function run(command, args, extraEnv = {}, allowFailure = false) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { env: { ...env, ...extraEnv }, windowsHide: true });
    let stdout = "", stderr = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Acceptance command timed out")); }, 25_000);
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      clearTimeout(timeout);
      if (code && !allowFailure) reject(new Error(stderr.slice(-1500) || stdout.slice(-1500)));
      else accept({ code, stdout: stdout.trim(), stderr });
    });
  });
}
const docker = (args, allowFailure = false) => run("docker", ["--config", resolve(configPath), ...args], {}, allowFailure);
// Docker Desktop installs Compose outside an isolated Docker configuration.
const composeBinary = process.env.DOCKER_COMPOSE_BIN || "C:/Program Files/Docker/Docker/resources/cli-plugins/docker-compose.exe";
const compose = args => existsSync(composeBinary)
  ? run(composeBinary, args, { DOCKER_CONFIG: resolve(configPath) })
  : docker(["compose", ...args]);
// Compose config preserves escaped dollars for round trips; container commands receive one.
const containerCommand = service => service.command.map(argument => argument.replaceAll("$$", "$"));
const sql = (query, database = "deutschmit_site") => docker(["exec", name, "psql", "-X", "-U", "site_user", "-d", database, "-v", "ON_ERROR_STOP=1", "-tAc", query]);
let created = false;
try {
  const emptyEnv = resolve(output, "synthetic.envfile");
  writeFileSync(emptyEnv, "# Intentionally empty; all values are synthetic process variables.\n");
  const config = JSON.parse((await compose(["--env-file", emptyEnv, "config", "--format", "json"])).stdout);
  const migration = config.services["site-migrate"];
  const retention = config.services["analytics-retention"];
  assert.equal(config.services.site.depends_on["site-migrate"].condition, "service_completed_successfully");
  assert.equal(migration.environment.DATABASE_URL, config.services.site.environment.DATABASE_URL);
  assert.equal(retention.environment.ANALYTICS_DATABASE_URL, config.services.analytics.environment.ANALYTICS_DATABASE_URL);
  assert.deepEqual(Object.keys(retention.networks), ["analytics_storage"]);
  assert.equal(retention.depends_on.analytics.condition, "service_healthy");
  assert.equal(retention.restart, "unless-stopped");
  assert(!config.services.db.healthcheck.test.join(" ").includes("regclass"));
  const databaseMount = migration.volumes.find(volume => volume.target === "/site-db");
  assert(databaseMount.read_only);
  await docker(["run", "--detach", "--rm", "--name", name, "--tmpfs", "/var/lib/postgresql/data",
    "--env", "POSTGRES_USER=site_user", "--env", "POSTGRES_DB=deutschmit_site",
    "--env", "POSTGRES_PASSWORD=" + password, "--publish", "127.0.0.1::5432",
    "--mount", "type=bind,source=" + databaseMount.source + ",target=/site-db,readonly",
    "--mount", "type=bind,source=" + resolve("services/analytics/db") + ",target=/analytics-db,readonly",
    "--mount", "type=bind,source=" + output + ",target=/acceptance,readonly", "postgres:16-alpine"]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await docker(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "site_user"], true);
    if (result.code === 0) { ready = true; break; }
    await delay(300);
  }
  assert(ready, "Synthetic PostgreSQL did not become ready");
  await sql("CREATE TABLE upgrade_sentinel (value text); INSERT INTO upgrade_sentinel VALUES ('preserve-existing-data')");
  const databaseUrl = "postgresql://site_user:" + password + "@127.0.0.1:5432/deutschmit_site";
  const migrate = () => docker(["exec", "--env", "DATABASE_URL=" + databaseUrl, name, ...containerCommand(migration)]);
  await migrate();
  await sql("INSERT INTO contact_requests(id,type,name,contact,payload) VALUES(gen_random_uuid(),'student','Synthetic','test@example.test','{\"type\":\"student\"}')");
  await migrate();
  assert.equal((await sql("SELECT (SELECT count(*) FROM contact_requests) || ':' || (SELECT count(*) FROM upgrade_sentinel) || ':' || (to_regclass('website_analytics_events') IS NOT NULL)")).stdout, "1:1:true");
  assert.equal((await sql("SELECT to_regclass('analytics_events') IS NULL")).stdout, "t");
  const failed = await docker(["exec", "--env", "DATABASE_URL=" + databaseUrl + "_missing", name, ...containerCommand(migration)], true);
  assert.notEqual(failed.code, 0, "Migration failure must block dependent site startup");

  await sql("CREATE ROLE analytics_user LOGIN PASSWORD '" + password + "'");
  await sql("CREATE DATABASE deutschmit_analytics OWNER analytics_user");
  await docker(["exec", name, "psql", "-X", "-U", "analytics_user", "-d", "deutschmit_analytics", "-v", "ON_ERROR_STOP=1", "-f", "/analytics-db/migrations/0001_create_analytics_events.sql"]);
  await sql("INSERT INTO analytics_events(product_id,event_id,event_name,schema_version,source,visitor_id,session_id,page_view_id,sequence,occurred_at,path,metadata) SELECT 'deutschmit',gen_random_uuid(),'page_view',1,'browser',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,now()-age,'/','{}' FROM (VALUES (interval '91 days'),(interval '89 days')) AS ages(age)", "deutschmit_analytics");
  const port = (await docker(["port", name, "5432/tcp"])).stdout.split(":").at(-1);
  const cleaned = await run(process.execPath, ["services/analytics/dist/services/analytics/src/cli.js", "retention"], {
    ANALYTICS_DATABASE_URL: "postgresql://analytics_user:" + password + "@127.0.0.1:" + port + "/deutschmit_analytics" });
  assert.equal(JSON.parse(cleaned.stdout).deleted, 1);
  assert.equal((await sql("SELECT count(*) FROM analytics_events", "deutschmit_analytics")).stdout, "1");
  assert.equal((await sql("SELECT count(*) FROM contact_requests")).stdout, "1");

  // Exercise the declared loop using deterministic doubles instead of waiting two days.
  writeFileSync(resolve(output, "npm"), "#!/bin/sh\n[ \"$*\" = \"run cleanup\" ] || exit 8\nn=$(cat /tmp/retention-count 2>/dev/null || echo 0)\nn=$((n+1))\necho $n > /tmp/retention-count\n[ $n -lt 3 ]\n");
  writeFileSync(resolve(output, "sleep"), "#!/bin/sh\n[ \"$1\" = \"86400\" ] || exit 8\necho $1 >> /tmp/retention-sleeps\n");
  await docker(["exec", name, "sh", "-ec", "mkdir /tmp/retention-bin; cp /acceptance/npm /acceptance/sleep /tmp/retention-bin/; chmod +x /tmp/retention-bin/*"]);
  const scheduled = await docker(["exec", "--env", "PATH=/tmp/retention-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", name, ...containerCommand(retention)], true);
  assert.equal(scheduled.code, 1, "Failed cleanup must exit for restart policy");
  assert.equal((await docker(["exec", name, "cat", "/tmp/retention-count"])).stdout, "3");
  assert.equal((await docker(["exec", name, "cat", "/tmp/retention-sleeps"])).stdout, "86400\n86400");
  const result = { upgrade: "PASS", repeatPreservesData: "PASS", migrationFailure: "PASS", separateDatabases: "PASS", retention90Days: "PASS", dailyScheduleAndFailure: "PASS" };
  writeFileSync(resolve(output, "integration.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (created) await docker(["rm", "--force", name]);
}
