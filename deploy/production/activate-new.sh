#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SITE=/opt/quiz-arena-site
op="$ROOT/deploy/production/operate.sh"
test -s "$SITE/deployment-state/off-verified-at.txt"
digest="$(docker manifest inspect --verbose ghcr.io/valerii-s84/deutsch-ist-einfach:sha-23b2a54-new | python3 -c 'import json,sys; d=json.load(sys.stdin); a=d if isinstance(d,list) else [d]; print(next(x["Descriptor"]["digest"] for x in a if x["Descriptor"].get("platform",{}).get("architecture")=="amd64"))')"
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]
image="ghcr.io/valerii-s84/deutsch-ist-einfach@$digest"
docker pull --quiet "$image"
test "$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = 23b2a543897a84511e6a74a8ef4d91c97029b876
trap 'code=$?; trap - ERR; "$op" stop-tracking; exit "$code"' ERR
printf 'FRONTEND_IMAGE=%s\nANALYTICS_IMAGE=deutschmit-analytics:sha-23b2a54\n' "$image" > "$SITE/release.env"
"$op" compose up -d --no-deps --wait --wait-timeout 120 frontend
docker inspect quiz-arena-site-frontend-1 --format '{{.State.StartedAt}}' > "$SITE/deployment-state/new-container-started-at.txt"
"$op" verify
date -u +%Y-%m-%dT%H:%M:%SZ > "$SITE/deployment-state/new-verified-at.txt"
cp "$SITE/release.env" "$SITE/deployment-state/new-images.env"
systemctl is-active deutschmit-db-backup.timer
docker inspect quiz-arena-site-site-db-1 quiz-arena-site-analytics-db-1 quiz-arena-site-analytics-1 --format '{{.Name}} {{json .HostConfig.PortBindings}}'
trap - ERR
printf 'NEW_DEPLOY_OK %s\n' "$image"
cat "$SITE/deployment-state/new-container-started-at.txt"
