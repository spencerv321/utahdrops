-- Per-store checks: keep "last attempted" apart from "last succeeded" so a
-- failed DABS request never looks like a fresh observation, and back off
-- products whose detail page keeps failing (lib/jobs/store-inventory.ts).
--   last_store_scrape     last attempt (existing column; unchanged meaning for old rows)
--   store_checked_at      last successful per-store observation
--   store_check_failures  consecutive failed attempts
--   store_retry_at        not retried before this time after a failure
alter table products add column if not exists store_checked_at timestamptz;
alter table products add column if not exists store_check_failures int not null default 0;
alter table products add column if not exists store_retry_at timestamptz;

-- Best known success time for existing rows: the newest per-store row we hold.
update products p
set store_checked_at = c.newest
from (select csc, max(scraped_at) as newest from store_inventory_current group by csc) c
where c.csc = p.csc and p.store_checked_at is null;
