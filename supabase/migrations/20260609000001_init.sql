-- BevFinder Utah — initial schema
-- Snapshot history tables are delta-encoded: a row is written only when the
-- observed values differ from the previous observation. `scrape_runs` records
-- every pass, so "as of" freshness comes from the run log, not row presence.

create extension if not exists pg_trgm;

-- ~50 state stores; seeded from product-detail store tables (includes lat/lng)
create table stores (
  id          int primary key,            -- DABS store number
  name        text not null,
  address     text,
  city        text,
  phone       text,
  lat         double precision,
  lng         double precision,
  is_club     boolean not null default false,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create table products (
  csc           text primary key,         -- DABS SKU / item code
  name          text not null,
  category      text,                     -- DABS display group, e.g. VODKA
  subcategory   text,                     -- class code / display subgroup
  size_ml       int,
  status        text,                     -- normalized code: 1 A D L N P S T U X
  is_spa        boolean not null default false,
  description   text,                     -- from product detail page
  -- denormalized latest observation (search/filter never joins history)
  current_price numeric(10,2),
  warehouse_qty int,
  store_qty     int,
  on_order_qty  int,
  in_stock      boolean not null default false,
  price_percentile_in_category numeric(5,2),  -- nightly compute; powers NL price tiers
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  last_store_scrape timestamptz           -- per-store pass rotation cursor
);
create index products_name_trgm on products using gin (name gin_trgm_ops);
create index products_fts on products using gin (to_tsvector('english', name));
create index products_category on products (category);
create index products_status on products (status);

-- statewide history, delta-encoded
create table inventory_snapshots (
  id            bigint generated always as identity primary key,
  csc           text not null references products(csc),
  scraped_at    timestamptz not null,
  warehouse_qty int,
  store_qty     int,
  on_order_qty  int,
  price         numeric(10,2)
);
create index inventory_snapshots_csc on inventory_snapshots (csc, scraped_at desc);

-- per-store history, delta-encoded (row only when qty changed)
create table store_inventory (
  id          bigint generated always as identity primary key,
  csc         text not null references products(csc),
  store_id    int not null references stores(id),
  qty         int not null,
  scraped_at  timestamptz not null
);
create index store_inventory_csc_store on store_inventory (csc, store_id, scraped_at desc);
create index store_inventory_store on store_inventory (store_id, scraped_at desc);

-- latest per-store quantity (upserted every pass; powers "near me" without window queries)
create table store_inventory_current (
  csc         text not null references products(csc),
  store_id    int not null references stores(id),
  qty         int not null,
  scraped_at  timestamptz not null,
  primary key (csc, store_id)
);
create index store_inventory_current_store on store_inventory_current (store_id) where qty > 0;

-- detected changes; drives alerts + /whats-new
create table inventory_events (
  id          bigint generated always as identity primary key,
  csc         text references products(csc),
  event_type  text not null,  -- restock | new_product | price_change | status_change
                              -- | out_of_stock | allocated_drop
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index inventory_events_created on inventory_events (created_at desc);
create index inventory_events_csc on inventory_events (csc, created_at desc);

create table watchlist (
  user_id     uuid not null references auth.users(id) on delete cascade,
  csc         text not null references products(csc),
  created_at  timestamptz not null default now(),
  primary key (user_id, csc)
);

create table alert_prefs (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  watchlist_email boolean not null default true,
  allocated_email boolean not null default false,
  updated_at      timestamptz not null default now()
);

create table allocated_drops (
  id           bigint generated always as identity primary key,
  drop_date    date,
  csc          text,                      -- often unknown; allocated page omits SKU
  product_name text not null,
  bottle_qty   int,
  price        numeric(10,2),
  store_text   text,                      -- raw store address string from DABS page
  county       text,
  store_id     int references stores(id), -- resolved by address match when possible
  drop_type    text not null default 'allocated',  -- allocated | rhdp_lottery
  detected_at  timestamptz not null default now(),
  unique (drop_date, product_name, store_text)
);
create index allocated_drops_date on allocated_drops (drop_date desc);

-- demand validation (Phase 3 instrument — segment question is mandatory in UI)
create table email_signups (
  email       text primary key,
  segment     text,                       -- consumer | bar_restaurant | supplier | other
  created_at  timestamptz not null default now()
);

-- observability + freshness + digest bookmarks
create table scrape_runs (
  id          bigint generated always as identity primary key,
  job         text not null,   -- catalog | store_inventory | allocated | xlsx | percentiles | digest
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  detail      jsonb
);
create index scrape_runs_job on scrape_runs (job, started_at desc);

-- ── Row level security ──────────────────────────────────────────────
-- Server code uses the direct Postgres connection (bypasses RLS).
-- The browser only ever touches watchlist/alert_prefs via the anon key.

alter table watchlist enable row level security;
create policy watchlist_select on watchlist for select using (auth.uid() = user_id);
create policy watchlist_insert on watchlist for insert with check (auth.uid() = user_id);
create policy watchlist_delete on watchlist for delete using (auth.uid() = user_id);

alter table alert_prefs enable row level security;
create policy alert_prefs_all on alert_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- public catalog data: readable by anyone, writable only by service role
alter table stores enable row level security;
alter table products enable row level security;
alter table inventory_snapshots enable row level security;
alter table store_inventory enable row level security;
alter table store_inventory_current enable row level security;
alter table inventory_events enable row level security;
alter table allocated_drops enable row level security;
create policy stores_read on stores for select using (true);
create policy products_read on products for select using (true);
create policy snapshots_read on inventory_snapshots for select using (true);
create policy store_inv_read on store_inventory for select using (true);
create policy store_inv_cur_read on store_inventory_current for select using (true);
create policy events_read on inventory_events for select using (true);
create policy drops_read on allocated_drops for select using (true);

-- locked down: no anon access at all (server-only)
alter table email_signups enable row level security;
alter table scrape_runs enable row level security;
