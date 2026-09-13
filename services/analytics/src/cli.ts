import { cleanRetention, deleteVisitor, openAnalyticsDatabase } from "./database";
import { migrate } from "./migrate";

async function main() {
  const [command, product, visitor, ...extra] = process.argv.slice(2);
  if (extra.length || !["migrate", "retention", "delete-visitor"].includes(command) || (command !== "delete-visitor" && (product || visitor)) || (command === "delete-visitor" && (!product || !visitor))) throw new Error("invalid_command");
  const sql = openAnalyticsDatabase();
  try {
    const result = command === "migrate" ? await migrate(sql) : command === "retention" ? await cleanRetention(sql) : await deleteVisitor(sql, product, visitor);
    console.log(JSON.stringify(result));
  } finally { await sql.end({ timeout: 5 }); }
}
main().catch(() => { console.error("analytics_maintenance_failed"); process.exitCode = 1; });
