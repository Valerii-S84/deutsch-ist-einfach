# Website Quiz Teaser VPS Frontend E2E Evidence

> Historical evidence from before the canonical rename to `deutsch-ist-einfach`
> (Deutsch ist einfach!). Image/container names and the page title below record the
> deployment tested on that date; current deployment instructions are in [README.md](../../README.md).

Date: 2026-05-12

Scope: Controlled Protected Beta frontend deploy and live verification for `website_quiz_teaser`. This was not a broad public launch, not public signup, and not a commercial launch.

## Handoff Used

- API Bank handoff: `/mnt/c/Users/User/Desktop/API Quiz Bank/reports/beta/website_quiz_teaser_vps_api_handoff_evidence_2026-05-12.md`
- Existing consumer: `website_quiz_teaser`
- No new API Bank consumer was created.
- No new credentials were generated.
- No API Bank repository files were changed.
- Secure env handoff used: `/root/api-quiz-bank/website-quiz-teaser.env` on VPS, mode `600`
- Masked API Bank base URL: `https://api.valerchik.de`

## Frontend Preflight

- Frontend repo branch: `main`
- Local `HEAD`: `cab3a4222a4c717f36edac88d87689ce59160a4e`
- `origin/main`: `cab3a4222a4c717f36edac88d87689ce59160a4e`
- Required commit present: `cab3a42 Verify website quiz teaser frontend E2E`
- Pre-report working tree: clean except known untracked `.codex`
- `.env`, `.env.local`, `.next`, and `*.tsbuildinfo` are git-ignored.

## Deployment

- Live URL tested: `https://deutchquizarena.de/`
- Frontend image deployed: `ghcr.io/valerii-s84/quiz-arena-frontend:sha-cab3a42`
- Deployed frontend revision label: `cab3a4222a4c717f36edac88d87689ce59160a4e`
- Runtime path: `/opt/quiz-arena`
- Frontend service env now receives server-side only:
  - `QUIZ_BANK_API_BASE_URL`
  - `QUIZ_BANK_EDGE_API_KEY`
  - `QUIZ_BANK_CONSUMER_ID`
  - `QUIZ_BANK_CONSUMER_API_KEY`
- Runtime env check from inside frontend container: all four values present.
- `NEXT_PUBLIC_*` was not used for API Bank secrets.
- Browser exposure check: HTML and JS scans found `0` quiz bank markers.

## Live Browser E2E Proof

Headless Chrome DevTools drove `https://deutchquizarena.de/`.

- Homepage opened: `200`
- Page title: `Startseite | Deutsch Quiz Arena`
- Quiz teaser visible: yes
- Placement: `#stats` before `#quiz-teaser`, and `#quiz-teaser` before `#bot`
- `Quiz starten` worked: yes
- Progress observed:
  - `Frage 1 von 5`
  - `Frage 2 von 5`
  - `Frage 3 von 5`
  - `Frage 4 von 5`
  - `Frage 5 von 5`
- Browser route statuses: `200, 200, 200, 200, 200, 429`
- Successful real question responses: `5`
- Feedback shown: yes
- Explanation shown: yes
- Final score shown: `Dein Ergebnis: 1/5`
- Telegram CTA: `Im Telegram-Bot weitermachen`
- Telegram CTA URL: `https://t.me/Deine_Deutsch_Quiz_bot?start=site_public_home`

Captured browser API-like traffic:

```text
POST /api/quiz-teaser/next -> 200
POST /api/quiz-teaser/next -> 200
POST /api/quiz-teaser/next -> 200
POST /api/quiz-teaser/next -> 200
POST /api/quiz-teaser/next -> 200
POST /api/quiz-teaser/next -> 429
```

- Browser direct API Bank calls: `0`
- Browser secret-like request headers: none
- Browser saw only the frontend route `/api/quiz-teaser/next`.

## Quota Behavior

- Final live quota state after E2E: `5/5`
- Retry after completion returned: `429`
- Frontend route body: `{"error":"quiz_teaser_quota_exceeded"}`
- Public UI message:

```text
Das Quiz-Limit für heute ist erreicht. Bitte versuche es später erneut oder mache im Telegram-Bot weiter.
```

No technical backend error, auth code, stack trace, or raw API Bank reason code was shown to the public user.

Note: an initial browser capture reached the final score but exited before writing its evidence summary because of a local CDP script assertion bug. The API Bank daily usage was reset once for the existing beta consumer only, then the final successful capture above was run and left quota at `5/5`.

## Security Proof

- API Bank credentials are read only by `app/api/quiz-teaser/next/route.ts`.
- Browser code calls only `/api/quiz-teaser/next`.
- API Bank is reached from the Next.js server route, not the browser.
- Live HTML scan:
  - downloaded HTML files: `1`
  - quiz bank marker hits: `0`
- Live JS bundle scan:
  - downloaded JS files: `10`
  - quiz bank marker hits: `0`
- Browser network:
  - direct `api.valerchik.de` calls: `0`
  - direct `/v1/quiz-items/next` calls: `0`
  - API key / consumer / quizbank browser header names: none
- Tracked Git raw secret scan using secure handoff values:
  - raw secret file hits: `0`
- Remote compose/Caddy raw secret scan:
  - raw secret file hits: `0`
- `.env.local` and `.env` are git-ignored.
- This report contains no raw API Bank secrets.

Fail-closed and public error behavior:

- Missing env: covered by `app/api/quiz-teaser/next/route.test.ts`, returns safe `503` with `quiz_teaser_unavailable`.
- Wrong credential / unauthorized upstream: covered by route tests, maps to safe unavailable response.
- Suspended / forbidden upstream: covered by route tests, maps to safe unavailable response.
- Quota exceeded: proven live, maps to clean quota UI.

## Build And Checks

```text
npm run lint      -> pass
npm test          -> pass (17 files, 105 tests)
npm run typecheck -> pass
npm run build     -> pass
npm run ci        -> pass
```

Frontend build result:

```text
next build -> pass
/api/quiz-teaser/next -> dynamic server route
/ -> dynamic server-rendered page
```

## Service Status And Logs

Production service restart:

```text
docker compose -f docker-compose.prod.yml up -d frontend caddy
```

Service status after E2E:

```text
quiz-arena-api-1           api        running   healthy
quiz-arena-frontend-1      frontend   running
quiz-arena-worker-1        worker     running
quiz_arena_beat_prod       beat       running
quiz_arena_caddy_prod      caddy      running
quiz_arena_postgres_prod   postgres   running   healthy
quiz_arena_redis_prod      redis      running   healthy
```

Frontend logs check:

```text
Next.js 15.5.15 started successfully.
Frontend ready in 346ms.
No frontend runtime errors observed in the checked log window.
```

API Bank access proof from server side:

```text
api_bank_call_count_since_10m=11
```

The count includes the interrupted capture and final live browser E2E. Browser capture still showed `0` direct API Bank calls.

## Known Risks / Not Done

- This is a controlled beta teaser with a `5/day` quota; quota exhaustion is expected after one full live run.
- The deploy changed VPS runtime configuration under `/opt/quiz-arena`; no broad public launch or signup campaign was performed.
- API Bank credentials remain operational secrets and were not rotated during this task.
- No unrelated UI redesign, section move, or public signup/commercial launch work was performed.
