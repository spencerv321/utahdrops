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
- The Claude sandbox cannot reach utahdrops.com or DABS (egress policy). Verify
  prod via Actions logs / `report.yml`; test UI locally (Postgres 16 + seeded
  data + Playwright with Chromium at /opt/pw-browsers).

## Data gotchas
- DABS sometimes returns bogus zero quantities; the catalog job rejects passes
  where too many in-stock products drop to 0. Don't remove that guard.
- After an outage (>48h), the first catalog pass suppresses events on purpose.
- Alerts dedupe via `alert_deliveries`; `store_restock` events only go to users
  with that home store and are hidden from the public feed.
- Some SKUs always 500 on the DABS detail page; the store job rotates them out.
