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
  Per-store stock refreshes in rotation, so every store count shows its check
  time. Claim rules live in `lib/store-freshness.ts`: negatives ("none near",
  "not at your store") only from checks < 24h; a newer statewide count can
  disprove a store count (none statewide, or fewer than the store had) but
  never confirm one. Don't write "right now" about store counts.

## Search, watching, freshness (PRs #25–#27)
- Search matches `products.search_key`. Its SQL function and
  `lib/search-key.ts` must stay identical (aliases list in both); after any
  change run `npx tsx scripts/search-check.ts` (parity + real-bottle
  regression set). Only add explicit aliases; never strip plural "s" or merge
  sizes/vintages.
- Signed-out watches go through `watch_intents` → `/watch/confirm`; applying
  must stay idempotent and email-bound. Never toggle a watch off from a callback.
- Store job: `store_checked_at` = last success, `last_store_scrape` = last
  attempt, `store_retry_at` = backoff. Don't let a failure touch
  `store_checked_at`. Size changes go through `lib/jobs/store-capacity.ts`
  and must keep in-stock rotation ≤ 3 days without extending the 7-day cutoff.
- Freshness claims in copy come from `WATCH_REFRESH_NOTE`; only raise them
  after `report.yml` → `freshness` shows it.
- Tests: `pnpm test` (pure, in CI), `pnpm test:db` (local Postgres with the
  catalog; sends no email). Report modes worth knowing: `freshness`,
  `searchcheck`, `storediag:<csc>`, `storecoverage`.

## Worth a look (/discover)
- Discovery rules, not rarity: thresholds live only in `DISCOVER`
  (`lib/discover-rules.ts`). Never loosen one to fill the page; review real
  candidates with `report.yml` → `discover`. Nearby claims need a successful
  store check < 24h; unknown stays "not checked", never "none".
- Allocated-drop and drawing quantities are never stock; drawing products are
  excluded from actionable lists.
- `discover_events` counts actions; a confirmed watch is `watch_added`,
  written only when a watch is actually added (signed-in toggle or verified
  intent), never on the Watch tap. Headless browsers are dropped as bots.

## Data gotchas
- DABS sometimes returns bogus zero quantities; the catalog job rejects passes
  where too many in-stock products drop to 0. Don't remove that guard.
- After an outage (>48h), the first catalog pass suppresses events on purpose.
- Alerts dedupe via `alert_deliveries`; `store_restock` events only go to users
  with that home store and are hidden from the public feed.
- Some SKUs always 500 on the DABS detail page (often sold-out allocated
  bottles); the store job backs them off (6h → 72h) and a catalog restock
  clears the backoff.
- GitHub starts scheduled runs ~2h late (max ~6h) but hasn't dropped slots
  while workflows are enabled; count runs per slot before concluding otherwise.
