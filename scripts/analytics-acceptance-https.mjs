// Generate an ephemeral localhost certificate in memory. Never open existing keys.
import { spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { request } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Reuse the already available test image's cryptography library in a fresh,
// networkless container without mounts, runtime credentials or backend access.
const generated = spawnSync("docker", ["--config", resolve(".docker-test-config"), "run", "--rm", "--network", "none", "--entrypoint", "python", "admin-acceptance-test-backend:latest", "-c", `
import json
from datetime import datetime, timedelta, timezone
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Synthetic analytics localhost')])
now = datetime.now(timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=1)).not_valid_after(now+timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]), critical=False).add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True).sign(key, hashes.SHA256()))
print(json.dumps({'cert': cert.public_bytes(serialization.Encoding.PEM).decode(), 'key': key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()}))
`], { encoding: "utf8", windowsHide: true });
if (generated.status !== 0) throw new Error("Synthetic certificate generation failed; requires the existing isolated test image and Docker access");
const tls = JSON.parse(generated.stdout);
mkdirSync(".verification/website-analytics", { recursive: true });
writeFileSync(".verification/website-analytics/localhost.crt", tls.cert); // Public cert only; key stays in this process.
function proxy(port, upstreamPort) {
  const handler = (incoming, outgoing) => {
  const upstream = request({ hostname: "127.0.0.1", port: upstreamPort, path: incoming.url, method: incoming.method, headers: { ...incoming.headers, "x-forwarded-proto": "https", "x-forwarded-for": incoming.headers["x-forwarded-for"] ?? "127.0.0.1" } }, response => {
    if (outgoing.destroyed || outgoing.writableEnded) { response.destroy(); return; }
    outgoing.writeHead(response.statusCode, response.headers);
    response.on("error", () => outgoing.destroy());
    response.pipe(outgoing);
  });
  upstream.on("error", () => {
    if (outgoing.destroyed || outgoing.writableEnded) return;
    if (outgoing.headersSent) outgoing.destroy();
    else { outgoing.writeHead(503); outgoing.end(); }
  });
  incoming.on("aborted", () => upstream.destroy());
  outgoing.on("close", () => { if (!outgoing.writableFinished) upstream.destroy(); });
  incoming.pipe(upstream);
  };
  for (const host of ["127.0.0.1", "::1"]) createServer(tls, handler).listen(port, host, () => console.log(`Synthetic HTTPS ready on ${host}:${port}`));
}
proxy(44453, 43828);
if (process.argv.includes("--with-quiz")) proxy(48453, 48000);
