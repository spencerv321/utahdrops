-- "Worth a look" (/discover) measurement. Page views stay in page_events
-- (path '/discover' gives unique and returning visitors); this holds the
-- actions on discovery results. Server-only (RLS on, no policies).
--   click          a product link on a discovery result
--   watch_click    Watch tapped on a result (signed in or not)
--   watch_request  a signed-out visitor asked for the sign-in email
--   watch_added    the watch was actually added (signed-in toggle, or after
--                  the email link was verified)
--   useful_yes / useful_no   "Was this useful?"
-- No IPs or emails: visitor_id is the random browser id page_events uses.
create table if not exists discover_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null,
  surface     text not null,   -- discover | home
  view        text,            -- scarce | back | price
  csc         text,
  visitor_id  text,
  user_id     uuid
);
create index if not exists discover_events_created on discover_events (created_at desc);
alter table discover_events enable row level security;

-- Where a signed-out watch request came from ("discover:price"), so the watch
-- is attributed when it's added after email verification.
alter table watch_intents add column if not exists source text;
alter table watch_intents add column if not exists visitor_id text;
