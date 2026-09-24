-- Utah Drops availability assessment ("rarity"), beta. Written by the
-- `rarity` job; read by product pages. Server-only (RLS on, no policies).
create table if not exists product_rarity (
  csc          text primary key,
  tier         text,                   -- everyday | uncommon | scarce | rare | unicorn; null = facts only
  published    boolean not null default false, -- badge shown (tier set, identity clear, confidence not low)
  label        text not null,          -- internal label, e.g. "Allocated release"
  headline     text not null,          -- plain-language line under the badge
  explanation  text not null,          -- one sentence, plain language
  evidence     jsonb not null,         -- display-ready facts, each with its dates
  confidence   text,                   -- confidence in the tier (source data is always cited)
  blocked_by   text,                   -- why a computed tier isn't published
  reason       text,                   -- technical reason (review report)
  method       text not null,
  computed_at  timestamptz not null default now()
);
alter table product_rarity enable row level security;

-- Manually reviewed corrections. A row here wins over the computed tier:
-- tier null hides the badge. Keep the reason and review date honest.
create table if not exists rarity_overrides (
  csc          text primary key,
  tier         text,                   -- null hides the badge
  explanation  text,                   -- optional replacement for the explanation line
  note         text not null,          -- why (internal)
  reviewed_on  date not null
);
alter table rarity_overrides enable row level security;
