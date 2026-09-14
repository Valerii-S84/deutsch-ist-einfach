# Production: deutschmit.de

Compose project: quiz-arena-site on ubuntu-8gb-nbg1-1.
External networks: quiz-arena-site-edge and quiz-arena-edge.
Caddy, Quiz Arena PostgreSQL, Redis, API, workers and their volumes remain separately owned.

Release sources: /opt/deutschmit-releases/<commit>.
Current release link: /opt/quiz-arena-site/current.
Configuration:

- Existing providers: /opt/quiz-arena-site/.env.site.
- Generated database/service credentials: /opt/quiz-arena-site/.env.analytics-v2, root only.
- Owner override: /opt/quiz-arena-site/.env.owner, root only; loaded after generated defaults.
- Current immutable images: /opt/quiz-arena-site/release.env.
- Verified tracking-off images: /opt/quiz-arena-site/off-release.env.

Never display or commit private environment files. The site uses the owner's existing
Quiz Arena email and password through the private owner override. Changing those
credentials invalidates site sessions. Quiz Arena's second-factor requirement is
controlled by its backend configuration; a successful password login alone does
not prove 2FA. Never enable an unverified authenticator and lock out the owner.

## Data and routing

site-db owns deutschmit_site; only db/migrate.psql applies its site baseline.
analytics-db owns deutschmit_analytics; only services/analytics/db/migrations apply
there. Neither database publishes a host port.

The original quiz_arena database remains separate. Legacy collection at
/api/public/website-analytics/events continues to the existing backend. New
collection at /api/public/analytics/events goes to Next.js and private Analytics.
The old frontend remains at https://deutchquizarena.de/admin; its /api/* still goes
to the original backend. The empty historical table in the new site database is
not the historical Quiz Arena source.

## Operations

Run as root on the named VPS:

    /opt/quiz-arena-site/current/deploy/production/operate.sh compose ps
    /opt/quiz-arena-site/current/deploy/production/operate.sh verify
    /opt/quiz-arena-site/current/deploy/production/operate.sh backup

analytics-retention runs the existing 90-day cleanup daily.
deutschmit-db-backup.timer runs daily at 03:30 UTC with up to five minutes jitter,
including missed runs. Both new databases are backed up to this VPS under
/var/backups/quiz-arena-site/v2-daily, mode 0700, for 14 days. Each archive is checked
with pg_restore --list and has a SHA-256 checksum. Archive structure validation is
not a full restore rehearsal. There is no off-server backup in this setup.

Restore Analytics into an isolated, inaccessible database. Apply retention and
replay authorized visitor deletions since the backup before exposing restored data.
Never restore Analytics into quiz_arena or deutschmit_site.

## Stop collection and rollback

    /opt/quiz-arena-site/current/deploy/production/operate.sh stop-tracking
    /opt/quiz-arena-site/current/deploy/production/operate.sh verify

The mode is compiled into the image; changing runtime environment is insufficient.
Record off/new digests and the exact activation UTC time in
/opt/quiz-arena-site/deployment-state/.

The pre-PR22 backup at /var/backups/quiz-arena-site/pre-pr22-20260913T180855Z contains
old Compose, Caddyfile, image digests, and the Quiz Arena database archive. For full
rollback restore the old Caddy routing and frontend together, validate and reload
Caddy. Preserve both new volumes and all original product services.

Acceptance includes site owner login, private query APIs, all six reports,
historical frontend access, consent/revoke browser checks, a marked synthetic
contact, and comparison with stored events. Historical login/2FA requires the
owner's existing credentials; 401 alone only proves authentication is required.

## Reporting and synthetic checks

Production sets SITE_LEGACY_ANALYTICS_SOURCE=quiz-arena. The historical report
redirects inside the protected Quiz Arena gateway and requires its own login.
Do not fall back to the empty site table on an authentication or backend error.
Analytics raw data is retained in analytics_events. All reporting reads the
analytics_report_events view, excluding only owner-registered test visitor IDs
from analytics_excluded_visitors. Test contacts use is_test=true and remain
available under the Test requests source; production is the default list.

The existing database backup policy remains unchanged. Workstation copies and
additional backup or authentication setup were explicitly removed from scope.

The production source archive and operations manifest must match the exact local
Git commit used to build both images. Keep previous image IDs and configuration
before a rollout. Additive reporting migrations are compatible with rollback.
