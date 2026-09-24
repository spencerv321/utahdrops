-- DABS Rare High Demand Product (RHDP) drawings, from the public drawing page
-- (webapps2.abc.utah.gov/ProdApps/RareHighDemandProducts). One row per
-- product per drawing. Winner names on that page are never stored.
-- Server-only (RLS on, no policies), like scrape_runs.
create table if not exists rhdp_drawings (
  drawing      text not null,           -- drawing title, e.g. "PAPPY VAN WINKLE & BUFFALO TRACE ANTIQUE COLLECTION 2026"
  item_code    text not null,           -- 6-digit, same as products.csc / monthly_sales.item_code
  product_name text not null,
  price        numeric(10,2),
  bottles      int,                     -- bottles offered in the drawing
  entries      int,                     -- entries received (past drawings)
  section      text not null,           -- future | current | past (as last seen)
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  primary key (drawing, item_code)
);
create index if not exists rhdp_drawings_item on rhdp_drawings (item_code);
alter table rhdp_drawings enable row level security;
