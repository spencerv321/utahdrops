import { sql } from "@/lib/db";

/**
 * The taste-search pilot covers a fixed, reviewed set of everyday wines, not
 * the whole catalog. Selection is stratified so the pilot spans styles, prices
 * and how widely a bottle is stocked: per style group, bottles are split into
 * price and stock thirds and taken evenly from each cell, in a stable
 * (md5-of-code) order so reruns pick the same bottles. Within a cell, bottles
 * whose DABS listing we've already read come first (the profile needs it).
 */
export const PILOT_QUOTAS: Record<string, number> = {
  white: 95,
  red: 85,
  rose: 35,
  sparkling: 45,
};

/**
 * SQL for the four pilot style groups, keyed like PILOT_QUOTAS. Like
 * lib/categories.ts, red/white look only at the part before " - ", so
 * "ALE - RED, AMBER, BROWN" isn't a red wine.
 */
export const PILOT_GROUP_SQL = `
  case
    when category like 'SPARKLING WINE%' then 'sparkling'
    when category like 'ROSE WINE%' or category like 'BLUSH WINE%' then 'rose'
    when split_part(category, ' - ', 1) ~ '\\mWHITE\\M' then 'white'
    when split_part(category, ' - ', 1) ~ '\\mRED\\M' and category !~ 'ALLOCATED|OFFER' then 'red'
  end`;

export async function selectPilotWines(): Promise<{ csc: string; grp: string }[]> {
  const rows = (await sql.unsafe(`
    with base as (
      select csc, ${PILOT_GROUP_SQL} as grp, current_price, store_qty,
             store_checked_at is not null and description is not null as has_listing
      from products
      where in_stock and delisted_at is null
        and coalesce(status, '') not in ('A', 'N', 'S', 'X')
        and category not like 'SPECIAL ORDERS%'
        and size_ml between 375 and 1500
        and search_name !~ '(\\mcans?\\M|\\m\\d+ ?pk\\M|variety|\\mbox\\M)'
        and current_price is not null
    ), cells as (
      select *, ntile(3) over (partition by grp order by current_price) as price_third,
                ntile(3) over (partition by grp order by store_qty nulls first) as stock_third
      from base where grp is not null
    ), ranked as (
      select *, row_number() over (partition by grp, price_third, stock_third order by has_listing desc, md5(csc)) as rn
      from cells
    )
    select csc, grp from ranked order by grp, rn, price_third, stock_third`)) as unknown as { csc: string; grp: string }[];

  // Round-robin across the nine cells of each group until its quota is met.
  const out: { csc: string; grp: string }[] = [];
  const taken: Record<string, number> = {};
  for (const r of rows) {
    if ((taken[r.grp] ?? 0) >= (PILOT_QUOTAS[r.grp] ?? 0)) continue;
    taken[r.grp] = (taken[r.grp] ?? 0) + 1;
    out.push(r);
  }
  return out;
}
