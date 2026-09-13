#!/usr/bin/env bash
# First deployment only. Future releases use operate.sh with explicit image digests.
set -euo pipefail
test "$(hostname)" = ubuntu-8gb-nbg1-1
test "$(id -u)" = 0
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SITE=/opt/quiz-arena-site
BACKUP=/var/backups/quiz-arena-site/pre-pr22-20260913T180855Z
OLD_IMAGE=ghcr.io/valerii-s84/quiz-arena-frontend@sha256:917b57a98f21144563dced3428e40571b5d580d1bbefe504b05e3e4d03834545
test "$(basename "$ROOT")" = 23b2a543897a84511e6a74a8ef4d91c97029b876
test -r "$SITE/.env.site"
test -s "$BACKUP/quiz_arena_before.dump"
cmp -s "$BACKUP/Caddyfile.before" /opt/infra-caddy/Caddyfile
awk '/MemAvailable:/ {if ($2<819200) exit 1}' /proc/meminfo
docker network inspect quiz-arena-site-edge quiz-arena-edge > /dev/null
umask 077
python3 - <<'PY'
import os,secrets
path='/opt/quiz-arena-site/.env.analytics-v2'
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
values={'SITE_ADMIN_EMAIL':'info@deutschmit.de',
        'SITE_ADMIN_PASSWORD':secrets.token_urlsafe(30),
        'SITE_ADMIN_SESSION_SECRET':secrets.token_hex(32),
        'SITE_DB_PASSWORD':secrets.token_hex(32),
        'ANALYTICS_DB_PASSWORD':secrets.token_hex(32),
        'ANALYTICS_SERVICE_KEY':secrets.token_hex(48)}
with os.fdopen(fd,'w') as f:
    for k,v in values.items(): f.write(k+'='+v+'\n')
print('PRIVATE_CONFIGURATION_CREATED')
PY
test ! -e "$SITE/release.env"
cat > "$SITE/release.env" <<'ENV'
FRONTEND_IMAGE=ghcr.io/valerii-s84/deutsch-ist-einfach@sha256:e4462e1ba4dd4224fce192bd6063462eeb0c04075a6c5648d2544c173ab7d027
ANALYTICS_IMAGE=deutschmit-analytics:sha-23b2a54
ENV
cp "$SITE/release.env" "$SITE/off-release.env"
chmod +x "$ROOT/deploy/production/"*.sh
op="$ROOT/deploy/production/operate.sh"
bash -n "$op" "$ROOT/deploy/production/bootstrap.sh"
node_check_image=ghcr.io/valerii-s84/quiz-arena-frontend:sha-36d8b1d
docker run --rm --network none -i --entrypoint node "$node_check_image" --check --input-type=module < "$ROOT/deploy/production/check-runtime.mjs"
"$op" compose config --quiet
"$op" compose config --format json | python3 -c 'import json,sys; d=json.load(sys.stdin); s=d["services"]; assert len(s)==7; assert all(not x.get("ports") for x in s.values()); assert s["site-db"]["environment"]["POSTGRES_DB"]=="deutschmit_site"; assert s["analytics-db"]["environment"]["POSTGRES_DB"]=="deutschmit_analytics"; assert s["site-migrate"]["volumes"][0]["source"].endswith("/23b2a543897a84511e6a74a8ef4d91c97029b876/db"); print("COMPOSE_ISOLATION_OK")'
"$op" compose pull --quiet frontend legacy-frontend
if ! "$op" compose build analytics > "$ROOT/analytics-build.log" 2>&1; then
  tail -20 "$ROOT/analytics-build.log"
  exit 1
fi
echo ANALYTICS_BUILD_OK
"$op" compose up -d --no-build --wait --wait-timeout 120 site-db analytics-db analytics legacy-frontend
rollback() {
  code=$?
  trap - ERR
  cat "$BACKUP/Caddyfile.before" > /opt/infra-caddy/Caddyfile
  docker exec infra_caddy_prod caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile > /dev/null 2>&1 || true
  FRONTEND_IMAGE="$OLD_IMAGE" docker compose -p quiz-arena-site --env-file "$SITE/.env.site" -f "$SITE/docker-compose.prod.yml" up -d --no-deps frontend
  echo "ROLLED_BACK_TO_PREVIOUS_FRONTEND; failure=$code" >&2
  exit "$code"
}
trap rollback ERR
"$op" compose up -d --no-build --wait --wait-timeout 120 frontend analytics-retention
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/infra-caddy/Caddyfile')
text=p.read_text()
old='deutschmit.de {\n\timport quiz_arena_routes\n\ttls {$CADDY_EMAIL}\n}'
new='''deutschmit.de {
    encode zstd gzip
    handle /api/public/website-analytics/events {
        uri strip_prefix /api
        reverse_proxy api:8000
    }
    handle /webhook* {
        reverse_proxy api:8000
    }
    handle /health {
        reverse_proxy api:8000
    }
    @internal path /api/ready /api/ready/* /internal/*
    handle @internal {
        respond "Not Found" 404
    }
    handle {
        reverse_proxy site-frontend:3000 {
            header_up X-Forwarded-For {remote_host}
        }
    }
    tls {$CADDY_EMAIL}
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}'''
assert text.count(old)==1,'unexpected site Caddy block'
text=text.replace(old,new)
old_legacy='deutchquizarena.de {\n\tencode zstd gzip'
new_legacy='''deutchquizarena.de {
    @legacyAdmin path /admin* /_next/*
    handle @legacyAdmin {
        reverse_proxy site-legacy:3000
    }
\tencode zstd gzip'''
assert text.count(old_legacy)==1,'unexpected legacy Caddy block'
text=text.replace(old_legacy,new_legacy)
Path('/opt/quiz-arena-site/Caddyfile.v2-candidate').write_text(text)
PY
docker inspect infra_caddy_prod --format '{{json .Mounts}}' | python3 -c 'import json,sys; assert any(x["Source"]=="/opt/infra-caddy/Caddyfile" and x["Destination"]=="/etc/caddy/Caddyfile" for x in json.load(sys.stdin))'
docker cp "$SITE/Caddyfile.v2-candidate" infra_caddy_prod:/tmp/deutschmit-v2-candidate.Caddyfile
docker exec infra_caddy_prod caddy validate --config /tmp/deutschmit-v2-candidate.Caddyfile --adapter caddyfile > "$ROOT/caddy-validation.log" 2>&1
# Preserve the inode of the file already bind-mounted by the shared Caddy.
cat "$SITE/Caddyfile.v2-candidate" > /opt/infra-caddy/Caddyfile
docker exec infra_caddy_prod caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile > /dev/null 2>&1
"$op" verify
test ! -e "$SITE/current"
ln -s "$ROOT" "$SITE/current"
"$op" backup
test ! -e /etc/systemd/system/deutschmit-db-backup.service
cat > /etc/systemd/system/deutschmit-db-backup.service <<'UNIT'
[Unit]
Description=Back up deutschmit site and Analytics databases
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
UMask=0077
ExecStart=/opt/quiz-arena-site/current/deploy/production/operate.sh backup
UNIT
cat > /etc/systemd/system/deutschmit-db-backup.timer <<'UNIT'
[Unit]
Description=Daily deutschmit database backups
[Timer]
OnCalendar=*-*-* 03:30:00 UTC
RandomizedDelaySec=300
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now deutschmit-db-backup.timer
mkdir -p "$SITE/deployment-state"
date -u +%Y-%m-%dT%H:%M:%SZ > "$SITE/deployment-state/off-verified-at.txt"
cp "$SITE/off-release.env" "$SITE/deployment-state/off-images.env"
sha256sum "$ROOT/deploy/production/"* > "$SITE/deployment-state/operations.sha256"
trap - ERR
echo OFF_DEPLOY_AND_BACKUP_OK
