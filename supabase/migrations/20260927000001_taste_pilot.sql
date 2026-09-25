-- Taste search pilot (lib/taste/*): evidence-backed profiles for a fixed,
-- stratified set of ~260 everyday wines, documented corrections, a review
-- log, and recommendation analytics. Server-only tables (RLS on, no policies).

-- One row per pilot wine. `profile` is lib/taste/profile.ts WineProfile: each
-- attribute keeps value (or null = unknown), evidence kind (product | style |
-- manual | none), source, quote and confidence. Re-extracted only when
-- input_hash (name, category, size, listing text, extractor version) changes.
create table if not exists wine_profiles (
  csc                 text primary key references products(csc),
  pilot_group         text not null,          -- white | red | rose | sparkling
  identity_status     text not null default 'ok', -- ok | ambiguous (never recommended)
  identity_note       text,
  profile             jsonb not null,
  input_hash          text not null,
  extractor_version   text not null,
  generic_description boolean not null default false, -- DABS repeats this text on several products
  source_read_at      timestamptz,            -- when the DABS listing text was last read (store check)
  extracted_at        timestamptz not null default now(),
  selected_at         timestamptz not null default now()
);
alter table wine_profiles enable row level security;

-- Documented manual corrections. They win over extracted values and are never
-- overwritten by the job. attribute: sweetness | body | fizz | region | grapes
-- | tag:<name> (value true/false) | exclude (value true: never recommend).
-- value null = set to unknown.
create table if not exists wine_profile_overrides (
  csc          text not null references products(csc),
  attribute    text not null,
  value        jsonb,
  note         text not null,
  reviewed_on  date not null,
  primary key (csc, attribute)
);
alter table wine_profile_overrides enable row level security;

-- Sample review before public use: one row per reviewed profile, with the
-- values that were checked, so a later change shows up as "changed since
-- review" (report.yml → taste). Written by the profile job from
-- lib/taste/review-log.ts.
create table if not exists wine_profile_reviews (
  csc             text primary key references products(csc),
  verdict         text not null,   -- ok | corrected (rule fixed) | excluded
  note            text,
  reviewer        text not null,
  reviewed_on     date not null,
  reviewed_values jsonb not null
);
alter table wine_profile_reviews enable row level security;

-- Recommendation analytics (no personal data: the random visitor id from the
-- page tracker, the structured request, and what was shown or clicked).
create table if not exists taste_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  kind          text not null,   -- shown | click | watch_click | feedback | interpret
  mode          text,            -- typed | guided | followup
  visitor_id    text,
  request       jsonb,
  csc           text,
  rank          int,
  results       int,
  useful        boolean,
  model_ms      int,
  input_tokens  int,
  output_tokens int,
  model_ok      boolean
);
create index if not exists taste_events_created on taste_events (created_at desc);
alter table taste_events enable row level security;

-- Where a watch came from ("taste" = a taste recommendation). Signed-out
-- requests carry it through watch_intents; the watch row keeps it once added.
alter table watch_intents add column if not exists source text;
alter table watchlist add column if not exists source text;
