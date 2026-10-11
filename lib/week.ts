import { sql } from "@/lib/db";
import type { FeedEvent } from "@/lib/queries";

/**
 * "This week": the last 7 days of DABS changes, grouped by what happened,
 * most interesting bottles first (rarity badge, then watchers, then price).
 * The same noise filter as the home feed: no special orders, delisted
 * products, cheap RTD packs and cans, or minis.
 */
export type WeekSectionKey = "restock" | "new_product" | "price_drop" | "status" | "sold_out";

export interface WeekSection {
  key: WeekSectionKey;
  events: FeedEvent[];
  /** Matching products this week before the per-section limit. */
  total: number;
}

export const WEEK_DAYS = 7;

const TIER_RANK = sql`case r.tier when 'unicorn' then 5 when 'rare' then 4 when 'scarce' then 3 when 'uncommon' then 2 when 'everyday' then 1 else 0 end`;

async function section(key: WeekSectionKey, where: ReturnType<typeof sql>, limit: number): Promise<WeekSection> {
  const rows = (await sql`
    with latest as (
      select distinct on (e.csc)
             e.id, e.csc, e.event_type, e.detail, e.created_at,
             p.name, p.category, p.status, p.current_price::text, p.in_stock, p.size_ml, p.store_qty,
             ${TIER_RANK} as tier_rank,
             (select count(*) from watchlist w where w.csc = e.csc)::int as watchers
      from inventory_events e
      join products p using (csc)
      left join product_rarity r on r.csc = p.csc and r.published
      where e.created_at > now() - make_interval(days => ${WEEK_DAYS})
        and p.delisted_at is null
        and coalesce(p.status, '') not in ('S', 'N', 'X')
        and coalesce(p.category, '') not like 'SPECIAL ORDERS%'
        and coalesce(p.current_price, 0) >= 20
        and coalesce(p.size_ml, 750) >= 375
        and p.search_name !~ '(\\m\\d+ ?pk\\M|variety|\\mrtd\\M|\\mcans?\\M|seltzer)'
        and ${where}
      order by e.csc, e.created_at desc
    )
    select *, count(*) over ()::int as total from latest
    order by tier_rank desc, watchers desc, current_price::numeric desc nulls last, created_at desc
    limit ${limit}`) as unknown as (FeedEvent & { total: number })[];
  return { key, events: rows, total: rows[0]?.total ?? 0 };
}

export async function getWeek(limit = 10): Promise<WeekSection[]> {
  return Promise.all([
    // Back in stores and still there.
    section("restock", sql`e.event_type = 'restock' and p.in_stock`, limit),
    section("new_product", sql`e.event_type = 'new_product'`, limit),
    // Real drops only (DABS also shaves cents off).
    section(
      "price_drop",
      sql`e.event_type = 'price_change' and (e.detail->>'new')::numeric <= (e.detail->>'old')::numeric * 0.95`,
      limit
    ),
    // News in a listing: now allocated, limited, or on clearance.
    section("status", sql`e.event_type = 'status_change' and e.detail->>'new' in ('A', 'L', 'D')`, limit),
    // Sold out statewide, only the ones people hunt for, and still gone.
    section(
      "sold_out",
      sql`e.event_type = 'out_of_stock' and not p.in_stock and (${TIER_RANK} >= 3 or p.status in ('A', 'L'))`,
      limit
    ),
  ]);
}
