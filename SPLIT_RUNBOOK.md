# Deutsch ist einfach! Repository Split Runbook (historical)

> This records the original repository extraction only. The Stage 6 standalone deployment is documented in [README.md](README.md); none of the backend cutover assumptions below apply to current deployment.

## Original goal

Extract `frontend/` into its own Git repository without changing the public routing surface:

- `/` and `/admin` stay on the Next.js frontend
- `/api/contact` is handled by the frontend; the remaining `/api/*` and `/webhook*` stay on the backend

This standalone repo is the result of that extraction.
Commands that reference monorepo-root `scripts/` are pre-export steps only.
These scripts existed only in the source monorepo before extraction; they are not part of this repo.

## Current standalone repo

- GitHub repo: `git@github.com:Valerii-S84/deutsch-ist-einfach.git`
- The initial history-preserving export from monorepo `main` has already been pushed here.

## Verified frontend boundary

The current frontend directory already carries its own repo-local bootstrap and boundary files:

- `package.json` with `npm run ci`
- `Dockerfile`
- `.env.example`
- `.gitignore`
- `.dockerignore`
- `lib/api-config.ts`
- `lib/api-routes.ts`
- `lib/public-site-config.ts`

## Before Export From The Monorepo

From the monorepo root:

```bash
git checkout main
git pull --ff-only
git status -sb
cd frontend
npm ci
npm run ci
```

Continue only with a clean worktree.

Monorepo-local automation for the same dry-run:

```bash
bash scripts/split_frontend_dry_run.sh --strategy filter-repo --cleanup
```

If the split-prep files are still only in the local `frontend/` working tree and not yet committed on `main`, add:

```bash
--include-working-tree
```

Fallback dry-run with the same script:

```bash
bash scripts/split_frontend_dry_run.sh --strategy subtree --cleanup
```

Monorepo-local actual export without push:

```bash
bash scripts/export_frontend_repo.sh \
  --strategy filter-repo \
  --include-working-tree \
  --output-dir .tmp/frontend-repo-export \
  --remote-url git@github.com:Valerii-S84/deutsch-ist-einfach.git
```

## Manual Extraction: `git filter-repo`

Use this when `git filter-repo` is available. It produces the cleanest standalone history rewrite.

```bash
git clone --branch main git@github.com:Valerii-S84/quiz-arena.git deutsch-ist-einfach
cd deutsch-ist-einfach
git filter-repo --path frontend/ --path-rename frontend/:
git remote remove origin
git remote add origin git@github.com:Valerii-S84/deutsch-ist-einfach.git
npm ci
cp .env.example .env.local
npm run ci
git push -u origin main
```

If a writable GitHub key lives only under Windows `C:\Users\<user>\.ssh`, WSL may reject the private key because `/mnt/c/...` permissions look too open. On this machine, the first push worked via Windows OpenSSH:

```bash
GIT_SSH_COMMAND="/mnt/c/Windows/System32/OpenSSH/ssh.exe -i C:/Users/<user>/.ssh/<key_name> -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
git push -u origin main
```

## Manual Fallback: `git subtree split`

Use this when `git filter-repo` is unavailable.

From the monorepo root:

```bash
git checkout main
git pull --ff-only
git subtree split --prefix=frontend -b split/frontend-root
git push git@github.com:Valerii-S84/deutsch-ist-einfach.git split/frontend-root:main
git branch -D split/frontend-root
```

Then validate from a fresh clone of the new frontend repo:

```bash
git clone --branch main git@github.com:Valerii-S84/deutsch-ist-einfach.git deutsch-ist-einfach
cd deutsch-ist-einfach
npm ci
cp .env.example .env.local
npm run ci
```

## Current standalone deployment

Use the repository-owned `compose.yml`, `Caddyfile`, `.env.example` and the [Stage 6 deployment instructions](README.md#standalone-docker-compose-stage-6). All site APIs and admin authentication belong to this repository. No backend-repository orchestration, shared Docker network, backend auth/2FA or Quiz Arena service is required.
