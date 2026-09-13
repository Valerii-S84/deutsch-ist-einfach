import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createAnalyticsHandler } from "./app";
import { openAnalyticsDatabase } from "./database";

function main() {
  const sql = openAnalyticsDatabase();
  const handle = createAnalyticsHandler(sql, process.env.ANALYTICS_SERVICE_KEY ?? "");
  const port = Number(process.env.ANALYTICS_PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid_port");
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: 10_000, headersTimeout: 10_000 }, async (incoming, outgoing) => {
    try {
      const init = { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(["GET", "HEAD"].includes(incoming.method ?? "GET") ? {} : { body: Readable.toWeb(incoming), duplex: "half" }) } as RequestInit;
      const response = await handle(new Request(`http://analytics${incoming.url}`, init));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(400); outgoing.end('{"error":"invalid_request"}'); }
  });
  server.listen(port, process.env.ANALYTICS_HOST ?? "0.0.0.0", () => console.log("analytics_listening"));
  const shutdown = () => {
    server.close(() => { void sql.end({ timeout: 5 }).then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
try { main(); } catch { console.error("analytics_startup_failed"); process.exitCode = 1; }
