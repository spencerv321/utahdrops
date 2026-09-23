-- One row per (user, event) actually emailed. The digest dedupes against this
-- instead of a "since last successful run" window, so a run that fails halfway
-- never re-sends to the users it already reached, and late-committed events
-- are still picked up.
create table alert_deliveries (
  user_id   uuid not null references auth.users(id) on delete cascade,
  event_id  bigint not null references inventory_events(id) on delete cascade,
  sent_at   timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index alert_deliveries_event on alert_deliveries (event_id);

-- server-only, like scrape_runs
alter table alert_deliveries enable row level security;

-- the digest filters events by type + recency
create index inventory_events_type_created on inventory_events (event_type, created_at desc);
