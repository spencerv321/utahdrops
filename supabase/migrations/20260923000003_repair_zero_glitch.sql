-- One-time repair. The 2026-09-23 19:43 UTC catalog pass received store_qty 0
-- from DABS for ~3k products that were in stock both before (Aug 4) and after
-- (20:14 pass). The 20:14 pass then emitted ~2,965 false "restock" events.
-- Remove those events and the bogus zero snapshots so no alert goes out and
-- quantity charts don't show a fake dip. The catalog job now rejects such
-- passes (MAX_DROPS_TO_ZERO).
with glitched as (
  select z.id as zero_snapshot_id, z.csc
  from inventory_snapshots z
  where z.scraped_at >= '2026-09-23 19:43:00+00'
    and z.scraped_at <  '2026-09-23 19:46:00+00'
    and z.store_qty = 0
    -- restored in the next pass
    and exists (
      select 1 from inventory_snapshots n
      where n.csc = z.csc and n.store_qty > 0
        and n.scraped_at >= '2026-09-23 20:14:00+00'
        and n.scraped_at <  '2026-09-23 20:17:00+00'
    )
    -- in stock at the observation just before
    and (
      select p.store_qty from inventory_snapshots p
      where p.csc = z.csc and p.scraped_at < z.scraped_at
      order by p.scraped_at desc limit 1
    ) > 0
),
deleted_events as (
  delete from inventory_events e
  using glitched g
  where e.csc = g.csc
    and e.event_type = 'restock'
    and e.created_at >= '2026-09-23 20:14:00+00'
    and e.created_at <  '2026-09-23 20:17:00+00'
  returning e.id
)
delete from inventory_snapshots s
using glitched g
where s.id = g.zero_snapshot_id;
