import type { Sql } from "postgres";
import photos from "../lib/bottle-photos.json";
import { GENERIC_DESCRIPTION_MIN } from "../lib/taste/profile";

/**
 * `report.ts phototargets[:N]`: which bottles to photograph first, among
 * listed, non-keg products. Interest first: watched, viewed by 2+ visitors in
 * 30 days, or a drawing/rare bottle (by watches, visitors, then sales). Then
 * everything else by DABS sales dollars over the last 3 report months (site
 * traffic is still too thin for a single view to mean much). Prints coverage
 * (share of product-page visitors the top N would cover) and a JSON list for
 * the photo harvest. Product data and aggregate counts only.
 */
type Target = { csc: string; name: string; size_ml: number | null; category: string | null; current_price: string | null;
  views: number; watches: number; sold: number; dollars: number; special: boolean; interest: boolean;
  description: string | null; shared: number };

/** Listed, non-keg products ranked by demand (see photoTargets). */
async function rankTargets(sql: Sql, n: number) {
  return sql<Target[]>`
    with views as (
      select csc, count(distinct visitor_id)::int as views
      from page_events where csc is not null and created_at > now() - interval '30 days' group by csc
    ), watches as (
      select csc, count(*)::int as watches from watchlist group by csc
    ), sold as (
      select item_code as csc, sum(bottles)::int as sold, sum(dollars)::float as dollars from monthly_sales
      where period_month >= (select max(period_month) from sales_reports) - interval '2 months' group by item_code
    ), special as (
      select item_code as csc from rhdp_drawings
      union select csc from product_rarity where published and tier in ('rare', 'unicorn')
      union select csc from rarity_overrides where tier in ('rare', 'unicorn')
    ), base as (
      select p.csc, p.name, p.size_ml, p.category, p.current_price, p.description,
             (select count(*)::int from products d where d.description = p.description) as shared,
             coalesce(v.views, 0) as views, coalesce(w.watches, 0) as watches, coalesce(s.sold, 0) as sold, coalesce(s.dollars, 0) as dollars,
             sp.csc is not null as special
      from products p
      left join views v using (csc) left join watches w using (csc) left join sold s using (csc)
      left join (select distinct csc from special) sp using (csc)
      where p.delisted_at is null and coalesce(p.size_ml, 0) < 19000
    )
    select *, (watches > 0 or views >= 2 or special) as interest from base
    order by (watches > 0 or views >= 2 or special) desc,
             case when watches > 0 or views >= 2 or special then watches end desc nulls last,
             case when watches > 0 or views >= 2 or special then views end desc nulls last,
             dollars desc, views desc, csc
    limit ${n}`;
}

export async function photoTargets(sql: Sql, n = 300) {
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  const rows = await rankTargets(sql, n);
  const [tot] = await sql<{ visitors: number; products: number }[]>`
    select count(distinct (visitor_id, csc))::int as visitors, count(distinct csc)::int as products
    from page_events where csc is not null and created_at > now() - interval '30 days'`;
  const hasPhoto = (csc: string) => csc in photos.products;
  const cov = [25, 50, 100, 200, 300].filter((k) => k <= n).map((k) => {
    const top = rows.slice(0, k);
    const v = top.reduce((a, r) => a + r.views, 0);
    return { top: k, product_page_visitors: v, share: tot.visitors ? +(v / tot.visitors).toFixed(3) : null,
      with_photo: top.filter((r) => hasPhoto(r.csc)).length };
  });
  const [viewed] = await sql<{ visitors: number }[]>`
    select count(distinct (visitor_id, csc))::int as visitors from page_events
    where csc = any(${Object.keys(photos.products)}) and created_at > now() - interval '30 days'`;
  show(`product-page visitors (30 days): ${tot.visitors} visitor-product pairs over ${tot.products} products; covered by the top N`, cov);
  show(`photos: ${Object.keys(photos.files).length} files covering ${Object.keys(photos.products).length} products; product-page visitors (30 days) who saw one`,
    [{ visitors: viewed.visitors, share: tot.visitors ? +(viewed.visitors / tot.visitors).toFixed(3) : null }]);
  show(`top ${rows.length} (${rows.filter((r) => r.interest).length} by interest, the rest by sales dollars)`, rows.map((r, i) => ({ rank: i + 1, csc: r.csc, name: r.name, size_ml: r.size_ml, category: r.category,
    price: r.current_price == null ? null : Number(r.current_price), views: r.views, watches: r.watches, sold: r.sold, dollars: Math.round(r.dollars), special: r.special, interest: r.interest, photo: hasPhoto(r.csc) })));
  return sql.end();
}

/**
 * `report.ts notetargets[:N]`: the same ranking, with each product's DABS
 * listing text (none / generic = shared verbatim by 2+ products / own), for
 * writing bottle notes. Product data only.
 */
export async function noteTargets(sql: Sql, n = 300) {
  const rows = await rankTargets(sql, n);
  const kind = (r: Target) => (!r.description ? "none" : r.shared >= GENERIC_DESCRIPTION_MIN ? "generic" : "own");
  const count = (k: string) => rows.filter((r) => kind(r) === k).length;
  console.log(`\n## DABS text among the top ${rows.length}: own ${count("own")}, generic ${count("generic")}, none ${count("none")}`);
  console.log(`\n## top ${rows.length}`);
  for (const [i, r] of rows.entries())
    console.log(JSON.stringify({ rank: i + 1, csc: r.csc, name: r.name, size_ml: r.size_ml, category: r.category, dabs: kind(r), text: r.description }));
  return sql.end();
}

/**
 * `report.ts photosurfaced`: bottles the public pages put in front of people
 * right now, chosen by rules rather than demand (so phototargets misses
 * many): every /discover candidate (all three views, statewide), the home
 * "Just happened" pool over 30 days, the latest 100 What's new rows, and
 * allocated drops from the last 90 days. Prints photo coverage per surface
 * and a JSON list of the ones without a photo for the harvest. Product data only.
 */
export async function photoSurfaced(sql: Sql) {
  const { getDiscoverCandidates } = await import("../lib/discover");
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  const surfaces: Record<string, string[]> = {};
  for (const view of ["scarce", "back", "price"] as const)
    surfaces[`discover:${view}`] = (await getDiscoverCandidates(view, null)).map((i) => i.csc);
  surfaces.home_feed_30d = (await sql<{ csc: string }[]>`
    select distinct e.csc from inventory_events e join products p using (csc)
    where e.created_at > now() - interval '30 days'
      and e.event_type in ('restock', 'new_product', 'price_change', 'status_change')
      and p.delisted_at is null and coalesce(p.status, '') not in ('S', 'N', 'X')
      and coalesce(p.category, '') not like 'SPECIAL ORDERS%'
      and coalesce(p.current_price, 0) >= 20 and coalesce(p.size_ml, 750) >= 375
      and p.search_name !~ '(\\m\\d+ ?pk\\M|variety|\\mrtd\\M|\\mcans?\\M|seltzer)'
      and (e.event_type <> 'price_change' or (e.detail->>'new')::numeric <= (e.detail->>'old')::numeric * 0.95)
      and (e.event_type <> 'status_change' or e.detail->>'new' in ('D', 'A', 'L'))
      and (e.event_type <> 'restock' or p.in_stock)`).map((r) => r.csc);
  surfaces.whats_new_100 = (await sql<{ csc: string }[]>`
    select e.csc from inventory_events e left join products p using (csc)
    where e.event_type <> 'store_restock'
      and coalesce(p.status, '') not in ('S', 'N') and coalesce(p.category, '') not like 'SPECIAL ORDERS%'
    order by e.created_at desc limit 100`).map((r) => r.csc);
  surfaces.drops_90d = (await sql<{ csc: string }[]>`
    select distinct csc from allocated_drops where csc is not null and drop_date > now() - interval '90 days'`).map((r) => r.csc);

  const hasPhoto = (csc: string) => csc in photos.products;
  show("photo coverage by surface", Object.entries(surfaces).map(([surface, cscs]) => {
    const u = [...new Set(cscs)];
    return { surface, products: u.length, with_photo: u.filter(hasPhoto).length };
  }));
  const where = new Map<string, string[]>();
  for (const [s, cscs] of Object.entries(surfaces)) for (const c of cscs) if (!hasPhoto(c)) where.set(c, [...(where.get(c) ?? []), s]);
  const rows = await sql<{ csc: string; name: string; size_ml: number | null; category: string | null; current_price: string | null; in_stock: boolean }[]>`
    select csc, name, size_ml, category, current_price, in_stock from products where csc = any(${[...where.keys()]}) and delisted_at is null`;
  // Discover first (the homepage preview), then the more surfaces the better, then in stock.
  const score = (c: string) => (where.get(c)!.some((s) => s.startsWith("discover")) ? 10 : 0) + where.get(c)!.length;
  rows.sort((a, b) => score(b.csc) - score(a.csc) || Number(b.in_stock) - Number(a.in_stock) || a.csc.localeCompare(b.csc));
  show(`without a photo: ${rows.length}`, rows.map((r, i) => ({ rank: i + 1, csc: r.csc, name: r.name, size_ml: r.size_ml, category: r.category,
    price: r.current_price == null ? null : Number(r.current_price), in_stock: r.in_stock, surfaces: where.get(r.csc) })));
  return sql.end();
}
