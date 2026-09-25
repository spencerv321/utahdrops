-- Store-by-store checks: one shared DABS pacer and a log of every check.
-- Server-only (RLS on, no policies).

-- One row every DABS request reserves its slot from, so the catalog job, the
-- store job and on-demand checks on Vercel share one pace (lib/dabs/client.ts)
-- instead of each process keeping its own.
create table if not exists dabs_pacer (
  id       int primary key default 1 check (id = 1),
  next_at  timestamptz not null default now()
);
insert into dabs_pacer (id) values (1) on conflict (id) do nothing;
alter table dabs_pacer enable row level security;

-- Every store check attempt (rotation, watched, on_demand), for freshness and
-- decay measurement (report.yml -> checks): how long checks take, how often
-- they fail, and how often a re-check finds store counts changed, by how old
-- the previous check was.
create table if not exists store_checks (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  csc              text not null,
  source           text not null,   -- rotation | watched | on_demand
  ok               boolean not null,
  ms               int,             -- DABS time for the check (both requests)
  error            text,
  prev_checked_at  timestamptz,     -- previous successful check, if any
  stores           int,             -- stores listed on the detail page
  stocked          int,             -- of those, with a positive count
  changed_stores   int,             -- stores whose count differs from the previous check
  statewide_qty    int              -- catalog statewide shelf count at the time
);
create index if not exists store_checks_created on store_checks (created_at desc);
create index if not exists store_checks_csc on store_checks (csc, created_at desc);
alter table store_checks enable row level security;
