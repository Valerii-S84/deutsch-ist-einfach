import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { AnalyticsDatabase } from "./database";

export async function migrate(sql: AnalyticsDatabase, directory = resolve(__dirname, "../../../../db/migrations")) {
  const files = (await readdir(directory)).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/.test(file)).sort();
  if (!files.length) throw new Error("analytics_migrations_missing");
  const statements = await Promise.all(files.map(file => readFile(resolve(directory, file), "utf8")));
  // Version 1 has just one idempotent migration, no additional tracking table.
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(1847021101)`;
    for (const statement of statements) await tx.unsafe(statement);
  });
  return { migrations: files };
}
