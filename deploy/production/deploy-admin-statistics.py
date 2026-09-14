"""Deploy only administrator statistics and the authorized Shorts event producer."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

def run(args, **kwargs):
    return subprocess.check_output(args, text=True, timeout=kwargs.pop("timeout", 180), **kwargs).strip()

assert os.geteuid() == 0 and run(["hostname"]) == "ubuntu-8gb-nbg1-1"
revision = sys.argv[1]
assert re.fullmatch("[0-9a-f]{40}", revision)
root = Path("/opt/deutschmit-releases") / revision
assert root.is_dir() and root.resolve() == root
site = Path("/opt/quiz-arena-site")
previous = (site / "current").resolve()
assert previous.parent == root.parent and previous != root
op = str(root / "deploy/production/operate.sh")
for shell in (root / "deploy/production").glob("*.sh"):
    shell.write_bytes(shell.read_bytes().replace(b"\r\n", b"\n"))
    shell.chmod(0o755)
front = "deutschmit-site:admin-" + revision[:12]
analytics = "deutschmit-analytics:admin-" + revision[:12]
builds = [
    ("frontend", ["docker", "build", "--target", "production", "-t", front,
     "--label", "org.opencontainers.image.revision=" + revision,
     "--build-arg", "NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=new",
     "--build-arg", "NEXT_PUBLIC_SITE_URL=https://deutschmit.de",
     "--build-arg", "NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/Deine_Deutsch_Quiz_bot",
     "--build-arg", "NEXT_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/doechkurse",
     "--build-arg", "NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL=https://t.me/Trainer1512_bot",
     "--build-arg", "NEXT_PUBLIC_CONTACT_EMAIL=info@deutschmit.de", "."]),
    ("analytics", ["docker", "build", "-f", "services/analytics/Dockerfile", "-t", analytics,
     "--label", "org.opencontainers.image.revision=" + revision, "."]),
]
mode = sys.argv[2] if len(sys.argv) == 3 else 'all'
assert mode in ('all', '--prepare', '--activate')
if mode != '--activate':
    for label, command in builds:
        print("BUILD_START " + label, flush=True)
        with (root / ("build-admin-" + label + ".log")).open("w") as log:
            result = subprocess.run(command, cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=900)
        if result.returncode:
            print("\n".join((root / ("build-admin-" + label + ".log")).read_text().splitlines()[-25:]))
            raise RuntimeError("BUILD_FAILED_" + label)
        print("BUILD_OK " + label, flush=True)
    
    # Real PostgreSQL acceptance in a disposable, isolated database before production changes.
    network = "shorts-acceptance-" + revision[:12]
    container = network + "-db"
    assert subprocess.run(["docker", "container", "inspect", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0
    run(["docker", "network", "create", "--internal", network])
    try:
        run(["docker", "run", "-d", "--name", container, "--network", network, "-e", "POSTGRES_USER=analytics_user",
             "-e", "POSTGRES_DB=deutschmit_analytics", "-e", "POSTGRES_PASSWORD=synthetic-shorts-only", "postgres:16-alpine"])
        run(["docker", "exec", container, "sh", "-ec", "for i in $(seq 1 30); do pg_isready -h 127.0.0.1 -U analytics_user -d deutschmit_analytics && exit 0; sleep 1; done; exit 1"], timeout=40)
        for migration in sorted((root / "services/analytics/db/migrations").glob("*.sql")):
            run(["docker", "exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "analytics_user", "-d", "deutschmit_analytics"], input=migration.read_text())
        for check in ["check-shorts-events.mjs", "check-report-exclusions.mjs"]:
            print(run(["docker", "run", "--rm", "-i", "--network", network,
                "-e", "ANALYTICS_DATABASE_URL=postgresql://analytics_user:synthetic-shorts-only@" + container + ":5432/deutschmit_analytics",
                analytics, "node", "--input-type=module"], input=(root / "deploy/production" / check).read_text()), flush=True)
    finally:
        subprocess.run(["docker", "rm", "-f", container], stdout=subprocess.DEVNULL)
        subprocess.run(["docker", "network", "rm", network], stdout=subprocess.DEVNULL)
    (root / 'admin-build-verified.txt').write_text(revision)
else:
    assert (root / 'admin-build-verified.txt').read_text() == revision
if mode == '--prepare':
    print('ADMIN_PREPARED ' + revision, flush=True)
    sys.exit(0)

front_id = run(["docker", "image", "inspect", "--format", "{{.Id}}", front])
analytics_id = run(["docker", "image", "inspect", "--format", "{{.Id}}", analytics])
release = site / "release.env"
old_release = release.read_text()
new_release = old_release
for name, value in [("FRONTEND_IMAGE", front_id), ("ANALYTICS_IMAGE", analytics_id)]:
    new_release, count = re.subn("(?m)^" + name + "=.*$", name + "=" + value, new_release)
    assert count == 1
old_state = root / "previous-release.env"
old_state.write_text(old_release)
old_state.chmod(0o600)
webroot = Path("/var/www/shortsblockerkids.de")
unchanged = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in [webroot / "index.html", webroot / "assets/styles.css"]}
script = webroot / "assets/site.js"
old_script = script.read_bytes()
assert b"shorts-website-analytics:start" not in old_script
caddy = Path("/opt/infra-caddy/Caddyfile")
old_caddy = caddy.read_bytes()
marker = "shortsblockerkids.de, www.shortsblockerkids.de {"
configuration = old_caddy.decode()
assert configuration.count(marker) == 1
addition = "\n\thandle /api/website-events {\n\t\trewrite * /api/analytics/shorts-blocker-kids\n\t\treverse_proxy site-frontend:3000\n\t}\n"
assert "handle /api/website-events" not in configuration
configuration = configuration.replace(marker, marker + addition, 1)
mounts = json.loads(run(["docker", "inspect", "infra_caddy_prod", "--format", "{{json .Mounts}}"]))
targets = [m["Destination"] for m in mounts if m["Source"] == str(caddy)]
assert len(targets) == 1
caddy_path = targets[0]
(root / "previous-shorts-site.js").write_bytes(old_script)
(root / "previous-Caddyfile").write_bytes(old_caddy)
try:
    release.write_text(new_release)
    run([op, "compose", "run", "--rm", "--no-deps", "analytics", "npm", "run", "migrate"])
    run([op, "compose", "up", "-d", "--no-deps", "--wait", "--wait-timeout", "120", "analytics", "frontend", "analytics-retention"])
    caddy.write_text(configuration)
    run(["docker", "exec", "infra_caddy_prod", "caddy", "validate", "--config", caddy_path], stderr=subprocess.DEVNULL)
    run(["docker", "exec", "infra_caddy_prod", "caddy", "reload", "--config", caddy_path], stderr=subprocess.DEVNULL)
    producer = (root / "deploy/production/shorts-browser.js").read_bytes()
    script.write_bytes(old_script.rstrip() + b"\n" + producer)
    for filename, expected in unchanged.items():
        assert hashlib.sha256(Path(filename).read_bytes()).hexdigest() == expected
    print(run(["docker", "exec", "-i", "quiz-arena-site-frontend-1", "node", "--input-type=module"],
        input=(root / "deploy/production/check-runtime.mjs").read_text()), flush=True)
    temporary = site / ("current-" + revision[:12])
    temporary.symlink_to(root)
    temporary.replace(site / "current")
    state = {"revision": revision, "frontend_image": front_id, "analytics_image": analytics_id, "previous_root": str(previous),
             "status": "runtime_verified_browser_pending", "shorts_homepage_and_css_unchanged": True}
    (site / "deployment-state/admin-statistics.json").write_text(json.dumps(state, indent=2))
    print(json.dumps(state), flush=True)
except BaseException:
    script.write_bytes(old_script)
    caddy.write_bytes(old_caddy)
    run(["docker", "exec", "infra_caddy_prod", "caddy", "reload", "--config", caddy_path], stderr=subprocess.DEVNULL)
    release.write_text(old_release)
    run([str(previous / "deploy/production/operate.sh"), "compose", "up", "-d", "--no-deps", "--wait", "--wait-timeout", "120", "frontend", "analytics", "analytics-retention"])
    print("PREVIOUS_RUNTIME_RESTORED_ADDITIVE_TABLE_RETAINED", flush=True)
    raise
