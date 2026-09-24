-- A signed-out visitor's "watch this bottle" request, kept while they verify
-- their email. The sign-in link carries only the random id; the watch is added
-- once, for the account whose email matches, within 24 hours (lib/watch-intent.ts).
create table if not exists watch_intents (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  csc          text not null references products(csc),
  store_id     int references stores(id),
  created_at   timestamptz not null default now(),
  applied_at   timestamptz,
  applied_user uuid references auth.users(id) on delete set null
);
create index if not exists watch_intents_created on watch_intents (created_at);

-- Server-only (direct Postgres connection); no policies, so the anon key can't read it.
alter table watch_intents enable row level security;
