// Run checks from a source copy with an explicit synthetic environment; no dotenv.
import { cpSync, existsSync, mkdirSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const command = process.argv[2] ?? "build";
const modeArgument = process.argv.find(value => value.startsWith("--analytics-mode="));
const analyticsMode = modeArgument?.split("=")[1] ?? "new";
if (!["legacy", "new", "off"].includes(analyticsMode)) throw new Error("Unknown analytics mode");
const v1 = process.argv.includes("--v1");
const target = resolve(root, ".verification/website-analytics", ...(v1 ? ["v1"] : []), ["dev", "start", "build"].includes(command) ? "site" : "checks");
mkdirSync(target, { recursive: true });
for (const entry of ["app", "lib", "content", "public", "db", "docs/statistics-fixtures", "services", "scripts", "package.json", "package-lock.json", "next.config.mjs", "next-env.d.ts", "tsconfig.json", "tailwind.config.ts", "postcss.config.js", "eslint.config.mjs", "vitest.config.ts", "vitest.setup.ts"]) {
  if (command !== "start" && existsSync(resolve(root, entry))) cpSync(resolve(root, entry), resolve(target, entry), { recursive: true, filter: source => !/[\\/](node_modules|dist|\.env[^\\/]*)($|[\\/])/.test(source) });
}
if (!existsSync(resolve(target, "node_modules"))) symlinkSync(resolve(root, "node_modules"), resolve(target, "node_modules"), "junction");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA)$/i.test(name)));
Object.assign(env, {
  NODE_ENV: command === "dev" ? "development" : command === "test" ? "test" : "production",
  DATABASE_URL: ["dev", "start"].includes(command) ? "postgresql://site_test:synthetic-site-only@127.0.0.1:45443/site_analytics_acceptance" : "", SITE_ADMIN_EMAIL: "site@example.test", SITE_ADMIN_PASSWORD: "synthetic-site-password",
  SITE_ADMIN_SESSION_SECRET: "synthetic-site-signing-key-at-least-32-bytes",
  QUIZ_ARENA_ADMIN_URL: "", NEXT_PUBLIC_SITE_URL: command === "dev" ? "http://localhost:43828" : "https://localhost:44453", NEXT_TELEMETRY_DISABLED: "1",
  ANALYTICS_SERVICE_URL: process.argv.includes("--reports") ? "http://127.0.0.1:45441" : "http://127.0.0.1:45440", ANALYTICS_SERVICE_KEY: "synthetic-analytics-key-at-least-32-bytes",
  ANALYTICS_TRUST_PROXY: "1",
  NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE: analyticsMode,
});
if (process.argv.includes("--with-quiz")) {
  env.QUIZ_ARENA_ADMIN_URL = "https://localhost:48453";
  env.NODE_EXTRA_CA_CERTS = resolve(root, ".verification/website-analytics/localhost.crt");
}
if (command === "verify") {
  for (const name of ["test", "lint", "typecheck", "analytics:build"]) {
    env.NODE_ENV = name === "test" ? "test" : "production";
    const status = await new Promise(resolveExit => {
      const child = process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", name === "test" ? "npm test" : `npm run ${name}`], { cwd: target, env, windowsHide: true, stdio: "inherit" })
        : spawn("npm", name === "test" ? ["test"] : ["run", name], { cwd: target, env, stdio: "inherit" });
      child.on("exit", code => resolveExit(code ?? 1));
      child.on("error", () => resolveExit(1));
    });
    if (status !== 0) process.exit(status);
  }
  process.exit(0);
}
const commands = {
  test: ["vitest/vitest.mjs", "run", ...process.argv.slice(3).filter(value => value !== modeArgument && !["--v1", "--with-quiz", "--reports"].includes(value))],
  lint: ["eslint/bin/eslint.js", ".", "--ext", ".js,.mjs,.cjs,.jsx,.ts,.mts,.cts,.tsx"],
  typecheck: ["typescript/bin/tsc", "--noEmit"],
  build: ["next/dist/bin/next", "build"],
  dev: ["next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "43828"],
  start: ["next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "43828"],
  "analytics:build": ["typescript/bin/tsc", "-p", "services/analytics/tsconfig.json"],
};
if (!commands[command]) throw new Error("Unknown acceptance command");
const [binary, ...args] = commands[command];
const child = spawn(process.execPath, [resolve(root, "node_modules", binary), ...args], { cwd: target, env, windowsHide: true, stdio: "inherit" });
child.on("exit", code => { process.exitCode = code ?? 1; });
