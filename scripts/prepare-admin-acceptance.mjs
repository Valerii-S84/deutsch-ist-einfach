// Copy application sources into an isolated directory; never load .env files.
import { cpSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const root = process.cwd();
const target = resolve(root, ".verification/site");
mkdirSync(target, { recursive: true });
for (const entry of ["app", "lib", "content", "public", "db", "docs", "scripts", "package.json", "package-lock.json", "next.config.mjs", "next-env.d.ts", "tsconfig.json", "tailwind.config.ts", "postcss.config.js", "eslint.config.mjs", "vitest.config.ts", "vitest.setup.ts"]) {
  if (existsSync(resolve(root, entry))) cpSync(resolve(root, entry), resolve(target, entry), { recursive: true });
}
if (!existsSync(resolve(target, "node_modules"))) symlinkSync(resolve(root, "node_modules"), resolve(target, "node_modules"), "junction");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA)$/i.test(name)));
Object.assign(env, {
  NODE_ENV: process.argv[2] === "test" ? "test" : process.argv[2] === "dev" ? "development" : "production",
  DATABASE_URL: "postgresql://acceptance:synthetic-acceptance-only@127.0.0.1:45432/site_acceptance_test",
  SITE_ADMIN_EMAIL: "site@example.test", SITE_ADMIN_PASSWORD: "synthetic-site-password",
  SITE_ADMIN_SESSION_SECRET: "synthetic-site-signing-key-at-least-32-bytes",
  QUIZ_ARENA_ADMIN_URL: process.argv[2] === "dev" ? "http://127.0.0.1:48000" : "https://localhost:48443",
  NEXT_PUBLIC_SITE_URL: process.argv[2] === "dev" ? "http://localhost:43818" : "https://localhost:44443", NEXT_TELEMETRY_DISABLED: "1",
  NODE_EXTRA_CA_CERTS: resolve(root, ".verification/test-cert.crt"),
  API_INTERNAL_URL: "", NEXT_PUBLIC_API_URL: "", QUIZ_BANK_API_BASE_URL: "",
  QUIZ_BANK_EDGE_API_KEY: "", QUIZ_BANK_CONSUMER_ID: "", QUIZ_BANK_CONSUMER_API_KEY: "",
});
const command = process.argv[2] ?? "build";
if (!["build", "dev", "start", "test", "lint", "typecheck"].includes(command)) throw new Error("Unknown acceptance command");
const args = command === "test" ? ["vitest/vitest.mjs", "run"] : command === "lint" ? ["eslint/bin/eslint.js", ".", "--ext", ".js,.mjs,.cjs,.jsx,.ts,.mts,.cts,.tsx"] : command === "typecheck" ? ["typescript/bin/tsc", "--noEmit"] : ["next/dist/bin/next", command, ...(["dev", "start"].includes(command) ? ["--hostname", "127.0.0.1", "--port", "43818"] : [])];
args[0] = resolve(root, "node_modules", args[0]);
const child = spawn(process.execPath, args, { cwd: target, env, windowsHide: true, stdio: "inherit" });
writeFileSync(resolve(root, `.verification/${command}-process.json`), JSON.stringify({ pid: child.pid }));
child.on("exit", code => { process.exitCode = code ?? 1; });
