-- Products DABS stops listing: set by the catalog job after a full pass,
-- cleared if the product comes back.
alter table products add column if not exists delisted_at timestamptz;

-- "My stores": up to 3 home stores per user for per-store restock alerts.
create table if not exists user_stores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  store_id   int not null references stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
alter table user_stores enable row level security;
drop policy if exists user_stores_own on user_stores;
create policy user_stores_own on user_stores for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fixed-window counters for public endpoints (e.g. AI search). Server-only.
create table if not exists rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;

-- Legacy footer signups (collected before the footer sent magic links) get one
-- invitation email; this records who has been invited.
alter table email_signups add column if not exists invited_at timestamptz;
