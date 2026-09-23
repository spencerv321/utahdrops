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
| `DATABASE_URL` | app + jobs | On Vercel use the **transaction-mode pooler** (port 6543). |
| `DB_POOL_MAX` | app + jobs | Optional. Defaults to 3 on Vercel, 10 elsewhere. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | Auth only. |
| `NEXT_PUBLIC_SITE_URL` | app + emails | e.g. `https://utahdrops.com` |
| `CRON_SECRET` | `/api/cron/[job]` | Bearer token for the HTTP-triggered jobs. |
| `ANTHROPIC_API_KEY` | NL search | Without it, NL search falls back to keyword search. |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | digest | Without a key, emails are logged (dry run). |
| `DABS_CONTACT_EMAIL` | scrapers | Put in the User-Agent. Set it everywhere jobs run. |
| `STORE_SCRAPE_BUDGET` | store-inventory | SKUs per run. |

GitHub Actions secrets: `DATABASE_URL`, `DABS_CONTACT_EMAIL`, `CRON_SECRET`.

## Jobs

Run any job locally with `npx tsx scripts/scrape.ts <job>`.

| Job | Where it runs in prod | Schedule (UTC) |
|---|---|---|
| `catalog` | `.github/workflows/catalog.yml` (in the runner) | 06, 14, 22:00 |
| `store-inventory` | `.github/workflows/store-inventory.yml` (in the runner) | every 6h |
| `allocated`, `digest`, `percentiles`, `xlsx` | `.github/workflows/cron.yml` → `/api/cron/<job>` | see workflow |

`keepalive.yml` re-enables the scheduled workflows weekly (GitHub disables them
in public repos after 60 days without a commit). **`/api/health`** returns 503
when any job's last success is too old. Point an uptime monitor at it.

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

`supabase/migrations/`. Apply to the hosted project with `supabase db push`
(or paste into the SQL editor).
