// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsDatabase } from "./database";
import { migrate } from "./migrate";

const isTemplateCall = (value: unknown): value is TemplateStringsArray => Array.isArray(value) && "raw" in value;

let directory: string | undefined;

async function tempMigrationDir() {
  directory = await mkdtemp(join(tmpdir(), "analytics-migrations-"));
  return directory;
}

function sqlWithTransaction() {
  const tx = Object.assign(vi.fn((firstArg: unknown) => isTemplateCall(firstArg) ? undefined : firstArg), { unsafe: vi.fn() });
  const sql = { begin: vi.fn(async (callback: (tx: typeof tx) => unknown) => callback(tx)) } as unknown as AnalyticsDatabase;
  return { sql, tx };
}

describe("analytics migrations", () => {
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it("runs sorted migration files inside the advisory-lock transaction", async () => {
    const dir = await tempMigrationDir();
    await writeFile(join(dir, "ignored.sql"), "select ignored;");
    await writeFile(join(dir, "0002_second.sql"), "select 2;");
    await writeFile(join(dir, "0001_first.sql"), "select 1;");
    const { sql, tx } = sqlWithTransaction();

    await expect(migrate(sql, dir)).resolves.toEqual({ migrations: ["0001_first.sql", "0002_second.sql"] });

    expect(sql.begin).toHaveBeenCalledTimes(1);
    expect(tx).toHaveBeenCalledTimes(1);
    expect(tx.unsafe).toHaveBeenNthCalledWith(1, "select 1;");
    expect(tx.unsafe).toHaveBeenNthCalledWith(2, "select 2;");
  });

  it("fails closed when no migration files are present", async () => {
    await expect(migrate(sqlWithTransaction().sql, await tempMigrationDir())).rejects.toThrow("analytics_migrations_missing");
  });
});
