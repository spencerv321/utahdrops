-- Drawing alerts: email opted-in people when a DABS drawing is announced,
-- opens, and (when DABS shows a close date) the day before it closes.
-- Sent by lib/jobs/drawing-alerts.ts after each rhdp pass.

-- Opt-in, off by default: nobody gets these until they switch them on.
alter table alert_prefs add column if not exists drawing_email boolean not null default false;

-- One row per drawing we've seen open or upcoming: when we first saw it in
-- each state, and the close date if DABS's page gave one (never guessed).
create table if not exists rhdp_drawing_windows (
  drawing      text primary key,          -- same title as rhdp_drawings.drawing
  announced_at timestamptz,               -- first seen under "future"
  opened_at    timestamptz,               -- first seen under "current"
  closes_at    timestamptz,               -- parsed from DABS's page; null when it shows none
  dates_text   text,                      -- the text DABS shows beside the drawing (not product lines), for checking the parser
  updated_at   timestamptz not null default now()
);
alter table rhdp_drawing_windows enable row level security;

-- What we've recorded so far, so open/upcoming drawings have first-seen times.
insert into rhdp_drawing_windows (drawing, announced_at, opened_at)
select drawing,
       min(first_seen) filter (where section = 'future'),
       min(first_seen) filter (where section = 'current')
from rhdp_drawings
where section in ('future', 'current')
group by drawing
on conflict (drawing) do nothing;

-- Each (person, drawing, kind) at most once. kind: announced | open | closing.
create table if not exists drawing_alert_deliveries (
  user_id  uuid not null references auth.users(id) on delete cascade,
  drawing  text not null,
  kind     text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, drawing, kind)
);
alter table drawing_alert_deliveries enable row level security;
