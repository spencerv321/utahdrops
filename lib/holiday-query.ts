import { cache } from "react";
import { sql } from "@/lib/db";
import type { Area } from "@/lib/area";
import { baseCols, eligible, nearJoin, toItem, type DiscoverRowData } from "@/lib/discover";
import { nearState, type DiscoverItem } from "@/lib/discover-rules";
import { GROUPS, holidayGroup, isSeasonalListing, type HolidayGroup } from "@/lib/holiday";

export type HolidayItem = DiscoverItem & { group: HolidayGroup };

/**
 * Holiday bottles in stores now, by group (rules in lib/holiday.ts). Same
 * floor as Worth a look: in stock by a recent DABS count, ordinary retail,
 * no drawing bottles. Nearby claims follow the same 24h store-check rule.
 * SQL narrows by name/category; holidayGroup() decides.
 */
export const getHolidayShelf = cache(async (lat: number | null, lng: number | null) => {
  const area: Area | null = lat != null && lng != null ? { label: "", lat, lng } : null;
  const n = nearJoin(area);
  const rows = (await sql`
    with ${n.cte} _ as (select 1)
    select ${baseCols()}, ${n.cols}
    from products p
    left join product_rarity pr on pr.csc = p.csc
    left join rarity_overrides o on o.csc = p.csc
    ${n.join}
    where ${eligible()}
      and (p.category like 'GIFT SETS%' or p.category like '% OFFER' 
           or upper(p.name) ~ '(NOUVEAU|GLUHWEIN|GLUEHWEIN|GLOGG|MULLED|WASSAIL|NOG|PEPPERMINT|PPRMINT|PEP BARK|CANDY CANE|GINGERBREAD|CHRISTMAS|XMAS|HOLIDAY|NOEL|WINTER|YULE|JINGLE|FESTIVE|SNOW|SANTA|MISTLETOE)')`) as unknown as DiscoverRowData[];

  const byGroup = Object.fromEntries(GROUPS.map((g) => [g.key, [] as HolidayItem[]])) as Record<HolidayGroup, HolidayItem[]>;
  for (const r of rows) {
    const group = holidayGroup({ csc: r.csc, name: r.name, category: r.category });
    if (group) byGroup[group].push({ ...toItem(r), group });
  }
  // Nearby first (with an area), then DABS's seasonal buys before year-round
  // listings, then most stock statewide: the easiest to actually buy.
  const now = Date.now();
  const near = (i: DiscoverItem) => (area && nearState(i, true, now).kind === "near" ? 0 : 1);
  const year = (i: DiscoverItem) => (isSeasonalListing(i) ? 0 : 1);
  for (const g of GROUPS) {
    byGroup[g.key].sort(
      (a, b) => near(a) - near(b) || year(a) - year(b) || b.storeQty - a.storeQty || (a.csc < b.csc ? -1 : 1)
    );
  }
  return byGroup;
});
