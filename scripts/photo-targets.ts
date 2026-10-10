import type { Sql } from "postgres";
import photos from "../lib/bottle-photos.json";

/**
 * `report.ts phototargets[:N]`: which bottles to photograph first, among
 * listed, non-keg products. Interest first: watched, viewed by 2+ visitors in
 * 30 days, or a drawing/rare bottle (by watches, visitors, then sales). Then
 * everything else by DABS sales dollars over the last 3 report months (site
 * traffic is still too thin for a single view to mean much). Prints coverage
 * (share of product-page visitors the top N would cover) and a JSON list for
 * the photo harvest. Product data and aggregate counts only.
 */
export async function photoTargets(sql: Sql, n = 300) {
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  const rows = await sql<{ csc: string; name: string; size_ml: number | null; category: string | null; current_price: string | null;
    views: number; watches: number; sold: number; dollars: number; special: boolean; interest: boolean }[]>`
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
      select p.csc, p.name, p.size_ml, p.category, p.current_price,
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
