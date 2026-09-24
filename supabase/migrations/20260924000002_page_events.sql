-- First-party site analytics for the /admin dashboard. One row per page view,
-- written by /api/events; read only by the admin page. Server-only (RLS on,
-- no policies), like scrape_runs.
--
-- Privacy: no IP or raw user agent is stored. visitor_id is a random id the
-- browser keeps in localStorage (so we can tell new from returning visitors);
-- session_id lives in sessionStorage and rotates after 30 idle minutes.
create table if not exists page_events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  path           text not null,
  search_query   text,          -- ?q= on /search
  csc            text,          -- product code on /product/<csc>
  visitor_id     text not null,
  session_id     text not null,
  user_id        uuid,          -- signed-in visitor (no FK: keep history if an account is deleted)
  is_landing     boolean not null default false, -- first view of the session
  referrer_host  text,          -- set on the landing view only
  source         text,          -- channel bucket: Google, Reddit, Direct, Email…
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  country        text,
  region         text,
  city           text,
  device         text,          -- mobile | tablet | desktop
  browser        text,
  os             text
);

create index if not exists page_events_created on page_events (created_at desc);
create index if not exists page_events_visitor on page_events (visitor_id, created_at);
create index if not exists page_events_session on page_events (session_id, created_at);

alter table page_events enable row level security;
