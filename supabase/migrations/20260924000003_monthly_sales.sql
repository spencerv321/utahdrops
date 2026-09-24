-- Official DABS monthly sales (abs.utah.gov/vendors/sales-analysis), one
-- report per calendar month. Imported by the `sales` job; context for the
-- rarity work. Server-only (RLS on, no policies), like scrape_runs.
--
-- Facts to keep in mind when reading this:
-- * A product absent from a month's report is "not in report", not a
--   confirmed zero (DABS appears to omit products with no sales, unverified).
-- * One item code can appear on several lines in a month (vintages, renames);
--   every line is kept. Sum by item_code for per-product totals.
-- * Bottles sold are not bottles received.

create table if not exists sales_reports (
  period_month     date primary key,        -- first day of the calendar month
  fiscal_label     text not null,           -- "FY27 P2" (Utah FY starts in July)
  link_label       text,                    -- link text on the DABS page
  source_url       text not null,
  file_sha256      text not null,
  lines            int not null,
  item_codes       int not null,
  reused_codes     int not null,            -- codes on more than one line
  sum_dollars      numeric(14,2) not null,
  reported_dollars numeric(14,2),           -- DABS's own total, for reconciliation
  sum_bottles      int not null,
  imported_at      timestamptz not null default now()
);
alter table sales_reports enable row level security;

create table if not exists monthly_sales (
  period_month date not null references sales_reports(period_month) on delete cascade,
  line         int not null,                -- row order in the source file
  item_code    text not null,               -- 6-digit, same as products.csc
  item_name    text,
  class_code   text,
  class_name   text,
  size_ml      int,
  bottles      int,
  dollars      numeric(12,2),
  status       text,
  raw          jsonb not null,              -- the source row, header -> value
  primary key (period_month, line)
);
create index if not exists monthly_sales_item on monthly_sales (item_code, period_month);
alter table monthly_sales enable row level security;
