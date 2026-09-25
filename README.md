# Utah Drops

Fast search, restock alerts and allocated-drop tracking for Utah's state liquor
stores ([utahdrops.com](https://utahdrops.com)). Not affiliated with Utah DABS.

Next.js 16 (App Router) · Tailwind 4 · shadcn/ui · Supabase (Postgres + auth) ·
Resend (email) · Claude Haiku (natural-language search) · GitHub Actions (scrapers).

```
DABS locator / allocated page / product-list XLSX
        │  scrapers (lib/dabs, lib/jobs) — ≤1 req/s, identifiable UA
        ▼
Supabase Postgres  ──►  Next.js pages (lib/queries.ts)
        │
        └──►  digest job  ──►  Resend emails
```

## Local setup

```bash
pnpm install
supabase start                       # local Postgres + auth + Mailpit (needs Docker)
cp .env.example .env.local           # then fill in values
pnpm dev
```

Server code talks to Postgres directly via `lib/db.ts` (bypasses RLS). The
Supabase client is only used for auth.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | app + jobs | Supabase pooler URL. On Vercel a session-mode URL (port 5432) is switched to the transaction pooler (6543) automatically (`lib/db.ts`). |
| `DB_POOL_MAX` | app + jobs | Optional. Defaults to 3 on Vercel, 10 elsewhere. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | Auth only. |
| `NEXT_PUBLIC_SITE_URL` | app + emails | e.g. `https://utahdrops.com` |
| `CRON_SECRET` | `/api/cron/[job]` | Bearer token for the HTTP-triggered jobs. |
| `ANTHROPIC_API_KEY` | NL search | Without it, NL search falls back to keyword search. |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | digest | Without a key, emails are logged (dry run). |
| `DABS_CONTACT_EMAIL` | scrapers | Put in the User-Agent. Set it everywhere jobs run. |
| `STORE_SCRAPE_BUDGET` | store-inventory | SKUs per run. |
| `ADMIN_EMAILS` | `/admin` | Comma-separated emails allowed into the admin dashboard (sign in with the normal magic link). Unset = nobody. |

GitHub Actions secrets: `DATABASE_URL`, `DABS_CONTACT_EMAIL`, `CRON_SECRET`.

## Jobs

Run any job locally with `npx tsx scripts/scrape.ts <job>`.

Tests: `pnpm test` (pure, runs in CI) and `pnpm test:db` (needs a local
Postgres with the catalog loaded, see CLAUDE.md; never sends email).

| Job | Where it runs in prod | Schedule (UTC) |
|---|---|---|
| `catalog` | `.github/workflows/catalog.yml` (in the runner) | 06, 14, 22:00 |
| `store-inventory` | `.github/workflows/store-inventory.yml` (in the runner) | every 4h at :37 (GitHub starts runs ~2h late) |
| `allocated`, `digest`, `percentiles`, `rhdp`, `xlsx` | `.github/workflows/cron.yml` → `/api/cron/<job>` | see workflow (digest also runs after each catalog / store-inventory pass) |
| `sales` | `.github/workflows/sales.yml` (in the runner) | Mondays 16:40 |
| `rarity`, then `taste-profiles` | `.github/workflows/rarity.yml` (in the runner) | daily 09:50 |

`sales` imports DABS's monthly Sales Analysis reports
(abs.utah.gov/vendors/sales-analysis, May 2025 onward) into `sales_reports` /
`monthly_sales`, keeping every source row. A month is imported only if the link
text, file name, fiscal label and title month agree and the lines add up to
DABS's own total; months already in are skipped except the newest two
(dispatch with `refresh` to re-check all). A product missing from a month is
"not in report", not a confirmed zero, and bottles sold are not bottles
received. `rhdp` records DABS's Rare High Demand Product drawings (product, item code,
bottles offered, entries) from the public drawing page into `rhdp_drawings`;
winner names on that page are never stored. Sales, drawings, allocated drops
and our stock history feed the availability rating (beta, `lib/rarity.ts`):
the `rarity` job writes `product_rarity`, and product pages show a badge
(Everyday → Unicorn) only where `published` is true. Manual corrections go in
`rarity_overrides` (tier, or null to hide the badge, plus a note and review
date); they win over the computed tier. Dispatch `report.yml` with `rarity` to
review what the job would publish.

**Search** matches `products.search_key`, a normalized copy of the DABS name
(`public.search_key()` in SQL, mirrored by `lib/search-key.ts`): apostrophes
dropped, initials joined (E.H. → eh), numbers split off (12YR → 12 yr), and an
explicit list of DABS abbreviations and brand aliases (SNGL → single,
BLANTONS → blanton). Results rank by name match first, then availability and
location. `scripts/search-check.ts` (or `report.yml` → `searchcheck`) runs the
regression set of real bottles and checks the SQL/TS normalizers agree. The
category filter is a two-level view (`lib/categories.ts`) over the unchanged
DABS categories: `?group=vodka` for a type, `?category=` for one DABS category.

**Taste picks (beta, wine only)** extend search: a descriptive request ("a
white wine that's not super common and not too dry, under $30 near Draper"),
the "Help me choose" panel, and follow-ups all become one structured request
in the `/search` URL (`lib/taste/request.ts`: `wine`, `max`, `min`, `area`,
`sweet`, `body`, `like`, `novel`, `grape`; URL values override the typed
words, "any" clears). Rules read the words (`lib/taste/parse.ts`); Haiku is
only asked about words the rules couldn't read, may only fill empty taste
preferences, and has a 2.5s limit (`lib/taste/interpret.ts`). Kind, grape,
price and area are hard filters; area means fresh stock (checked in the last
72h) at a store within 10 mi. Sweetness, body, style words and novelty only
rank (`lib/taste/score.ts`). Recommendations cover a fixed pilot of 260
wines (`lib/taste/pilot-list.ts`) whose profiles keep evidence per attribute
(DABS listing text, name label or category; general style knowledge, marked
as such; or a documented override in `wine_profile_overrides`). The
`taste-profiles` job (after `rarity` in `rarity.yml`) re-extracts a profile
only when its inputs or `EXTRACTOR_VERSION` change. Evaluation:
`npx tsx scripts/taste-eval.ts` (or `report.yml` → `tasteeval`); coverage,
usage, feedback and model cost: `report.yml` → `taste`; wine-related search
words (counts only): `report.yml` → `searchlog`.

**Watching while signed out**: the Watch button sends visitors to
`/login?watch=<code>`, where they pick "anywhere in Utah" or "also at my store"
and enter an email. The request is saved in `watch_intents`; the sign-in link
carries only its id and lands on `/watch/confirm`, which adds the watch (and
home store) once, for the account with that email, within 24h
(`lib/watch-intent.ts`). Home stores add store alerts on top of statewide
ones; nothing suppresses statewide alerts.

**Freshness**: statewide counts come from the catalog pass (3×/day). Each
store pass (every 4h, 400 SKUs, ~15 min at the 1.1 s DABS pacing, stopping
cleanly at a 25-minute time budget) reserves up to 40% of its budget for
watched bottles not checked in 3h, then rotates everything else in stock
oldest-first: watched bottles every run, every in-stock bottle in ~2.5 days
(target 3, cutoff 7). The sizing model is `lib/jobs/store-capacity.ts`.
Products keep `last_store_scrape` (last attempt), `store_checked_at` (last
success) and a failure backoff (`store_retry_at`: 6h → 72h). The digest skips
superseded events (a restock that has sold out again, a store restock the
latest check contradicts) and dates every line. `report.yml` → `freshness`
shows capacity, watched-bottle freshness, overdue and failing checks, and
baseline coverage.

**Worth a look** (`/discover`, preview on the homepage): three discovery
views with rules in `lib/discover-rules.ts` (all thresholds in `DISCOVER`) and
SQL in `lib/discover.ts`. Every result is in stock by a catalog pass < 24h old
and sold at ordinary retail (no special orders, delisted products or anything
DABS releases by drawing). *Scarce*: published Scarce/Rare/Unicorn tier or a
manual override. *Back after a while*: out statewide ≥ 30 days with no catalog
gap > 48h inside the absence, previously in stock, back within 14 days (hidden
until anything qualifies). *Price drops*: latest `price_change` ≥ 10% and ≥ $3,
within 30 days, still the current price, previous price held ≥ 7 days, not a
reused code. "Nearby" = a positive store row within 10 mi from a successful
check < 24h old; otherwise "none near" (full check < 24h) or "not checked".
Clicks, Watch taps and completed watches go to `discover_events` (watch
attribution rides `watch_intents.source` through sign-in); `/admin` →
Discovery. Review real candidates with `report.yml` → `discover`.

Store-by-store counts older than 7 days (`STORE_DATA_MAX_AGE_HOURS`) are
treated as unknown everywhere: near-me counts and ordering, AI search, and the
product page (which then shows a dated "last known" list behind a toggle).

`keepalive.yml` re-enables the scheduled workflows weekly (GitHub disables them
in public repos after 60 days without a commit). **`/api/health`** returns 503
when any job's last success is too old; `health.yml` checks it every 3 hours and
fails (GitHub emails you) when it's red. `migrate.yml` applies new
`supabase/migrations/*.sql` to production on every push to `main`.

## Admin dashboard

`/admin` (admins only, see `ADMIN_EMAILS`): who's on the site now, visitors,
visits, bounce rate and sign-ups vs. the previous period, traffic sources and
campaigns, top pages/bottles/searches, cities and devices, accounts and alert
activity, and job freshness. Days are Mountain time; it refreshes every minute.

Page views come from our own beacon (`components/page-tracker.tsx` →
`/api/events` → `page_events`). No cookies or IPs are stored: a random visitor
id lives in localStorage, bots are dropped, admins aren't counted. Alert emails
tag their links `utm_source=email`, and any `?utm_source=` / `?ref=` on a shared
link shows up under Campaigns.

## Runbook: data stopped updating

1. Check `https://utahdrops.com/api/health` to see which job is stale.
2. Actions tab: are the workflows enabled? Enable them if not. What does the
   latest failed run's log say?
3. Supabase dashboard: is the project paused or out of space?
4. Run the job manually with **Run workflow** on its workflow.
5. After a gap of more than 48h, the first catalog pass suppresses events on
   purpose, so weeks of drift aren't emailed as "just restocked". Alerts
   resume from the next pass.

## Migrations

`supabase/migrations/`. Applied to production automatically by `migrate.yml`
(tracked in `public.app_migrations`), or locally with `npx tsx scripts/migrate.ts`.
