#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SITE_ROOT=/opt/quiz-arena-site
BACKUP_ROOT=/var/backups/quiz-arena-site/v2-daily
dc() {
  local owner_config=()
  if test -r "$SITE_ROOT/.env.owner"; then owner_config=(--env-file "$SITE_ROOT/.env.owner"); fi
  docker compose -p quiz-arena-site --project-directory "$ROOT" \
    --env-file "$SITE_ROOT/.env.site" --env-file "$SITE_ROOT/.env.analytics-v2" \
    "${owner_config[@]}" \
    --env-file "$SITE_ROOT/release.env" -f "$ROOT/deploy/production/compose.yml" "$@"
}
test "$(hostname)" = ubuntu-8gb-nbg1-1
case "$1" in
  compose)
    shift
    dc "$@"
    ;;
  backup)
    umask 077
    mkdir -p "$BACKUP_ROOT"
    chmod 700 "$BACKUP_ROOT"
    exec 9>"$BACKUP_ROOT/.backup.lock"
    flock -n 9 || exit 0
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    for db in analytics site; do
      file="$BACKUP_ROOT/$db-$stamp.dump"
      dc exec -T "$db-db" sh -c 'exec pg_dump -Fc --no-password -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$file.partial"
      test -s "$file.partial"
      dc exec -T "$db-db" pg_restore --list < "$file.partial" > /dev/null
      mv "$file.partial" "$file"
      sha256sum "$file" > "$file.sha256"
      printf 'BACKUP_OK %s %s bytes\n' "$file" "$(stat -c %s "$file")"
    done
    # Only this command's generated archives live in this dedicated directory.
    find "$BACKUP_ROOT" -maxdepth 1 -type f \
      \( -name 'analytics-*.dump' -o -name 'analytics-*.dump.sha256' -o -name 'site-*.dump' -o -name 'site-*.dump.sha256' \) \
      -mmin +20160 -delete
    ;;
  verify)
    dc exec -T frontend node --input-type=module < "$ROOT/deploy/production/check-runtime.mjs"
    dc exec -T analytics node --input-type=module <<'JS'
const url='http://127.0.0.1:3100';
for(const [path,key,expected] of [['/health',false,401],['/health',true,200],['/internal/products/deutschmit/overview?days=7',false,401]]) {
  const r=await fetch(url+path,{headers:key?{Authorization:'Bearer '+process.env.ANALYTICS_SERVICE_KEY}:{}});
  if(r.status!==expected) throw new Error(path+' unexpected status '+r.status);
}
console.log('ANALYTICS_HEALTH_AUTH_OK');
JS
    dc exec -T site-db psql -U site_user -d deutschmit_site -Atc "SELECT current_database(), 'contact_requests'::regclass, 'website_analytics_events'::regclass;"
    dc exec -T analytics-db psql -U analytics_user -d deutschmit_analytics -Atc "SELECT current_database(), 'analytics_events'::regclass;"
    ;;
  stop-tracking)
    test -r "$SITE_ROOT/off-release.env"
    cp "$SITE_ROOT/off-release.env" "$SITE_ROOT/release.env"
    dc up -d --no-deps --wait --wait-timeout 120 frontend
    printf 'Tracking stopped using the verified off image; both databases retained.\n'
    ;;
  *)
    echo 'Usage: operate.sh compose <args> | backup | verify | stop-tracking' >&2
    exit 2
    ;;
esac
