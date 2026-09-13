# Deutsch ist einfach!

This repository owns the public site, local site admin authentication, contact API
and Website Analytics API/storage. It builds and runs without the Quiz Arena
repository or backend. Quiz Arena statistics and the Quiz Bank teaser are optional.

Canonical repository, folder, npm package and Compose project name: `deutsch-ist-einfach`.

## Standalone Docker Compose (Stage 6)

```bash
git clone https://github.com/Valerii-S84/deutsch-ist-einfach.git
cd deutsch-ist-einfach
cp .env.example .env
# Fill POSTGRES_PASSWORD, SITE_ADMIN_EMAIL, SITE_ADMIN_PASSWORD,
# and SITE_ADMIN_SESSION_SECRET in .env, then:
docker compose up --build
```

On a new clone, plain `docker compose up` also builds the missing site image.
Open `https://localhost`, `/admin/login` and `/admin/dashboard`.
Docker Engine with Linux containers and Docker Compose v2 are required; host Node.js,
a separate PostgreSQL installation and other repositories are not required.

Compose starts only:

- `db`: site-owned PostgreSQL 16, with persistent `site_db` storage. Both existing
  SQL migrations run automatically on the first start with an empty volume.
- `site`: the production Next.js image built entirely from this repository. It
  starts after the database is reachable and both site tables exist.
- `caddy`: the site's HTTPS reverse proxy on ports 80/443. All paths, including
  `/api/*`, go to `site:3000`; it preserves the public Host and forwards the protocol.
  PostgreSQL and the Next.js port are not published to the host.

The admin auth contract requires HTTPS in production. Caddy uses a local CA for
`localhost`; the browser must trust that CA (or accept its local certificate for
testing). Export the **public CA certificate** after startup:

```bash
mkdir -p dist
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./dist/site-local-root.crt
```

Import this certificate into the local browser/OS
trust store. For a real deployment, set `SITE_ADDRESS` to the public hostname and
`NEXT_PUBLIC_SITE_URL` to its HTTPS URL before building. Point that hostname at the
server and make ports 80/443 reachable; Caddy obtains a public certificate automatically.
See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Environment

`.env.example` documents every application env consumer. `.env` is read by Compose;
existing `.env.local` files are excluded from the Docker build context.

| Variables | When needed |
|---|---|
| `POSTGRES_PASSWORD` | Required for Compose's site database. Generate a URL-safe password, e.g. `openssl rand -hex 32`. |
| `SITE_ADMIN_EMAIL`, `SITE_ADMIN_PASSWORD`, `SITE_ADMIN_SESSION_SECRET` | Required for local site admin login. Password: at least 12 characters; independently generated session secret: at least 32 bytes. No default credentials. |
| `DATABASE_URL` | Server-only connection used by contact and Website Analytics. Compose supplies `postgresql://site_user:<password>@db:5432/deutschmit_site` when blank. Set explicitly for npm or a separately managed site database. URL-encode credentials in an explicit URL. |
| `SITE_ADDRESS` | Caddy hostname, default `localhost`; no scheme or path. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | Public canonical site URL and contact email. |
| `NEXT_PUBLIC_TELEGRAM_BOT_URL`, `NEXT_PUBLIC_TELEGRAM_CHANNEL_URL`, `NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL` | Existing public CTA links. Working defaults are supplied. |
| `API_INTERNAL_URL`, `NEXT_PUBLIC_API_URL` | Optional Quiz Arena statistics; blank by default. Prefer runtime `API_INTERNAL_URL`. |
| `QUIZ_BANK_API_BASE_URL`, `QUIZ_BANK_EDGE_API_KEY`, `QUIZ_BANK_CONSUMER_ID`, `QUIZ_BANK_CONSUMER_API_KEY` | Optional Quiz Bank teaser; set all four only when enabling it. |

Database, admin credentials, `API_INTERNAL_URL` and Quiz Bank values are runtime-only;
they are never build arguments. `NEXT_PUBLIC_*` values are baked into the image and
require `docker compose up --build` after changes. Quote env values containing `$`
or `#` with single quotes in `.env`.

### Database lifecycle

The schema stays in `db/migrations/0001_create_contact_requests.sql` and
`db/migrations/0002_create_website_analytics_events.sql`. No new database architecture
or migration framework is introduced. The official PostgreSQL image applies these
files in name order **only when its data directory is empty**. Existing volumes are
preserved across `docker compose down` and subsequent starts; new migrations must be
applied explicitly before accepting traffic. Do not reapply the existing CREATE TABLE
scripts to a database that already has those tables. See the
[PostgreSQL image initialization contract](https://hub.docker.com/_/postgres).

An external PostgreSQL connection is also supported by the site image through
`DATABASE_URL`; apply both scripts to a fresh site database with `psql -v ON_ERROR_STOP=1
-f <migration-file>` before starting it. The supplied Compose stack is the bundled
database deployment and still starts `db` even if `DATABASE_URL` is overridden.

## Local npm development

```bash
npm ci
cp .env.example .env.local
# Configure DATABASE_URL for a reachable site PostgreSQL database and site admin env.
# Apply both db/migrations/*.sql files to a fresh database.
npm run dev
```

Development uses `http://localhost:3000` (set `NEXT_PUBLIC_SITE_URL` accordingly).
Production `npm run build && npm start` requires an HTTPS proxy with the original
Host and `X-Forwarded-Proto: https`, just like Compose.

## Optional integrations

- `NEXT_PUBLIC_API_URL` is only a fallback base URL for optional Quiz Arena public statistics. It does not configure site admin auth, contact or Website Analytics requests.
- If `NEXT_PUBLIC_API_URL` is absolute, it must point to the optional statistics API base,
  for example `https://quiz-stats.example`. The site's own `/api` routes are not a Quiz proxy.
- `API_INTERNAL_URL` is server-only, used for optional Quiz Arena public statistics.
- If `NEXT_PUBLIC_API_URL` is relative, set `API_INTERNAL_URL` explicitly for SSR.
- If `API_INTERNAL_URL` is unset, optional stats requests use an absolute `NEXT_PUBLIC_API_URL`. With neither configured, public statistics immediately show the unavailable fallback; there is no implicit localhost request. Site admin auth is independent of these values.
- The public homepage reads Quiz Arena's `GET /stats` endpoint as an optional integration; the `users` and `quizzes` metrics belong to Quiz Arena and are read-only for this site.
- If Quiz Arena is unavailable or the stats request reaches its bounded timeout, the homepage continues rendering and the stats section shows its existing unavailable fallback.
- The public site does not persist `users` or `quizzes` in the site database.
- Public contact submissions use the site-owned `POST /api/contact` route and do not use `NEXT_PUBLIC_API_URL` or the Quiz Arena backend.
- `DATABASE_URL` is a server-only runtime value used by site-owned contact and Website Analytics storage. Analytics events and dashboard aggregation use `website_analytics_events` from `db/migrations/0002_create_website_analytics_events.sql`.
- If Quiz Bank is unconfigured, unreachable or times out, `/api/quiz-teaser/next`
  returns the existing `503 quiz_teaser_unavailable` response and the teaser uses its
  existing unavailable state. Neither optional integration participates in startup
  dependencies or health checks.

## Image build and publishing

```bash
docker build --target production -t deutsch-ist-einfach .
```

The build needs no database, site credentials or Quiz backend. Public values can be
passed as `--build-arg NEXT_PUBLIC_...`; the bare image uses the application's public
defaults. The publish workflow derives its GHCR image name from `github.repository`
and publishes `:main` and `:sha-<commit>` tags. It embeds no Quiz backend address.

## Quality Gates

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run ci
```

`npm run lint` uses the repo-supported ESLint CLI path.
`npm run ci` is the frontend-local aggregate gate and the basis for the repo CI workflow.

## Routes

- Public: `/`, `/projects`, `/contact`
- Admin: `/admin/login`, `/admin/dashboard` (Website Analytics)

## Notes

- The homepage renders at request time, so optional statistics can be enabled through
  runtime env even when the image was built with Quiz OFF. Projects/contact retain
  their existing `revalidate = 3600` setting.
- `robots.txt` disallows `/admin`.
- Admin pages and `GET /api/admin/website-analytics/overview?days=7|30|90` independently require a validated site admin session. Website Analytics data comes from the site database.
- `lib/api-routes.ts` and `lib/api-config.ts` contain only the optional public statistics integration.
- The former Quiz Arena admin contact queue is no longer part of this frontend site.
- The frontend public-link env contract is centralized in `lib/public-site-config.ts`.
- Historical extraction steps live in `SPLIT_RUNBOOK.md`; they are not deployment instructions.

## Site admin auth contract (Stage 5)

`/admin/login` keeps the existing email/password form. Authentication is single-user
and local to this repository, with no auth backend, user database or 2FA.
Set these **server-only runtime environment variables**, never `NEXT_PUBLIC_*` or build arguments:

| Variable | Contract |
|---|---|
| `SITE_ADMIN_EMAIL` | Admin email used by the login form; surrounding env whitespace is trimmed. |
| `SITE_ADMIN_PASSWORD` | Strong, unique password of at least 12 characters; compared exactly. |
| `SITE_ADMIN_SESSION_SECRET` | Independently generated random signing secret of at least 32 bytes. |

Missing or undersized credentials disable login (`503`) and deny existing sessions.
There are no default credentials. Secrets are read only in
`lib/server/site-admin-auth.ts`, protected by the `server-only` import boundary.

- `POST /api/admin/login` accepts same-origin JSON `{ "email": "…", "password": "…" }`.
  Invalid credentials return `401` without setting a cookie. Success returns `{ "ok": true }`
  and issues a signed HMAC-SHA256 session; credentials are absent from both payload and response.
- The host-only `site_admin_session` cookie has `HttpOnly`, `SameSite=Strict`, `Path=/`,
  an 8-hour maximum age, and `Secure` in production (HTTPS required).
- The secure admin layout validates the signature and expiry locally. The Website Analytics
  endpoint does the same before any storage read and returns `401` without a valid session.
- `POST /api/admin/logout` expires the local cookie and redirects to `/admin/login`.
  Sessions are stateless: logout ends the current browser session; a copied token remains
  valid until expiry. Rotating the email, password or signing secret invalidates all tokens.
- Login and logout require an exact site Origin and reject cross-site fetch metadata.
  When proxied, the request `Host` must preserve the public site host; forwarded host
  headers are not trusted. No third-party cookies or token exchange are used.
- Login allows 10 attempts per minute per server process across all submitted identities.
  The in-memory limit resets on restart and is not shared between replicas.
- Auth responses and Analytics reads use `Cache-Control: private, no-store`.

Admin login/dashboard work with Quiz Arena configuration absent or its backend offline.
Quiz Bank and public statistics remain independent optional integrations. The old auth
transport, backend session adapter, auth routes, 2FA, cookie/CSRF handling, backend smoke
script and Axios dependency have been removed. `react-hook-form` and `@hookform/resolvers`
remain in use by the preserved login form.

Local coverage: `lib/server/site-admin-auth.test.ts`, `app/api/admin/login/route.test.ts`,
the secure layout test and the Website Analytics route test cover invalid/expired/tampered
sessions, credentials, origin checks, cookie attributes, logout and operation with Quiz Arena OFF.

## Адміністративний контроль продуктів

Адмінка має окремий розділ Quiz Arena Bot і каркаси deutschmit.de, Deutsch Trainer Bot, сайту Shorts Blocker Kids. Наявна власна аналітика сайту збережена. Локальне відновлення має статус **Partial** до перевірки актуального backend та постумов дій. Підключення використовує лише серверну `QUIZ_ARENA_ADMIN_URL`; без неї недоступний тільки розділ бота. Деталі, втрати, обмеження і приймання — у [карті адміністративного контролю](docs/admin-restoration.md), визначення — у [контрактах метрик](docs/statistics-contract.md).
