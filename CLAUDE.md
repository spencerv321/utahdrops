@AGENTS.md

# Working on Utah Drops

Read `README.md` (architecture, env vars, jobs, runbook) and `STATUS.md` (current
state) first. `REVIEW.md` is the 2026-09-23 audit; `review/` holds its screenshots.

## How the owner works
- Claude does the work end to end: branch, PR, CI, merge (owner approves the
  merge prompts), then verify in production. Keep explanations plain and short.
- Never send emails to real users (invites, blasts) without explicit approval.

## Shipping safely
- Every PR runs `ci.yml` (lint, typecheck, build). Keep `pnpm lint` clean.
- Migrations: add an idempotent file in `supabase/migrations/`. Before merging
  code that depends on it, dispatch `migrate.yml` on the PR branch so the
  schema lands before Vercel deploys. `migrate.yml` also runs on push to main.
- Production diagnostics: dispatch `report.yml` (read-only; job runs, events by
  type, samples). Extend `scripts/report.ts` rather than guessing.
- Jobs can be run manually from Actions: `catalog.yml`, `store-inventory.yml`,
  `cron.yml` (input `job`), `health.yml`, `keepalive.yml`.
- The cloud sandbox has open web access (DABS, utahdrops.com, the wider web).
  Hit live sources directly when building or debugging scrapers. If a host is
  ever refused, check it with curl before assuming a policy block — some sites
  (e.g. Total Wine) 403 bots on their own. Production secrets aren't in the
  sandbox, so DB-side diagnostics still go through `report.yml`; test UI
  locally (Postgres 16 + seeded data + Playwright with Chromium at /opt/pw-browsers).

- Local testing with real data works: Postgres 16 is installed (`service
  postgresql start`), then create a DB, stub `auth` (schema, `auth.users`,
  `auth.uid()`, roles anon/authenticated/service_role), run
  `npx tsx scripts/migrate.ts`, `scripts/scrape.ts catalog`, and a small
  `store-inventory` pass (`STORE_SCRAPE_BUDGET=100`). Leave
  `DABS_CONTACT_EMAIL` blank locally. Playwright + Chromium work for
  screenshots against `localhost` (Chromium doesn't trust the sandbox proxy
  CA, so it can't load outside sites; use Node fetch/curl for those).
- The auto-mode safety check may block steps that look like widening your
  own access (editing agent instructions, certificate trust, workarounds
  after a refusal). Stop and ask the owner; don't route around it.

## Design notes
- Espresso/amber/burgundy theme, Instrument Serif + Sans. Share cards
  (`opengraph-image` routes) use `lib/og.tsx` with TTF fonts and pre-toned
  JPEGs in `assets/` (Satori can't read WOFF2 or WebP).
- Visitor area lives in the `ud_area` cookie (`lib/area*.ts`); "near" = 10 mi.
  Per-store stock refreshes in rotation (~1–4 days old), so "near" counts
  show their check date when older than 36h.

## Data gotchas
- DABS sometimes returns bogus zero quantities; the catalog job rejects passes
  where too many in-stock products drop to 0. Don't remove that guard.
- After an outage (>48h), the first catalog pass suppresses events on purpose.
- Alerts dedupe via `alert_deliveries`; `store_restock` events only go to users
  with that home store and are hidden from the public feed.
- Some SKUs always 500 on the DABS detail page; the store job rotates them out.
