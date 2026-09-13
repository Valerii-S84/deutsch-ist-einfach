// Test-only fixed TCP relays: Docker Desktop cannot publish an internal-only network.
import { createServer, connect } from "node:net";
for (const [port, host, target] of [[3100, "analytics", 3100], [5432, "analytics-db", 5432], [5433, "site-db", 5432]]) {
  createServer(client => {
    const upstream = connect(target, host);
    client.pipe(upstream).pipe(client);
    client.on("error", () => upstream.destroy()); upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy()); upstream.on("close", () => client.destroy());
  }).listen(port, "0.0.0.0");
}
