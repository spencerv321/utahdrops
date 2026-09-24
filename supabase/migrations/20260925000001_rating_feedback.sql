-- "Does this rating seem wrong?" notes from product pages (rating beta).
-- Server-only (RLS on, no policies); read on /admin.
create table if not exists rating_feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  csc         text not null,
  tier_shown  text,                 -- badge the visitor saw (null = not rated)
  message     text not null,
  visitor_id  text                  -- random browser id (as in page_events), no IP stored
);
create index if not exists rating_feedback_created on rating_feedback (created_at desc);
alter table rating_feedback enable row level security;
