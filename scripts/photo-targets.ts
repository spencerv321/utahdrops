import type { Sql } from "postgres";

/**
 * `report.ts phototargets[:N]`: which bottles to photograph first. Ranks
 * listed, non-keg products by demand: product-page visitors (30 days),
 * watches, bottles sold in the last 3 DABS sales months, and drawings/rare
 * tiers. Prints coverage (share of product-page visitors the top N would
 * cover) and a JSON list for the photo harvest. Product data and aggregate
 * counts only.
 */
export async function photoTargets(sql: Sql, n = 300) {
  const show = (title: string, rows: unknown) => console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);
  const rows = await sql<{ csc: string; name: string; size_ml: number | null; category: string | null; current_price: string | null;
    views: number; watches: number; sold: number; special: boolean; score: number }[]>`
    with views as (
      select csc, count(distinct visitor_id)::int as views
      from page_events where csc is not null and created_at > now() - interval '30 days' group by csc
    ), watches as (
      select csc, count(*)::int as watches from watchlist group by csc
    ), sold as (
      select item_code as csc, sum(bottles)::int as sold from monthly_sales
      where period_month >= (select max(period_month) from sales_reports) - interval '2 months' group by item_code
    ), special as (
      select item_code as csc from rhdp_drawings
      union select csc from product_rarity where published and tier in ('rare', 'unicorn')
      union select csc from rarity_overrides where tier in ('rare', 'unicorn')
    ), base as (
      select p.csc, p.name, p.size_ml, p.category, p.current_price,
             coalesce(v.views, 0) as views, coalesce(w.watches, 0) as watches, coalesce(s.sold, 0) as sold,
             sp.csc is not null as special
      from products p
      left join views v using (csc) left join watches w using (csc) left join sold s using (csc)
      left join (select distinct csc from special) sp using (csc)
      where p.delisted_at is null and coalesce(p.size_ml, 0) < 19000
    )
    select *, round((
        3 * case when views > 0 then percent_rank() over (order by views) else 0 end
      + 2 * case when watches > 0 then percent_rank() over (order by watches) else 0 end
      + 2 * case when sold > 0 then percent_rank() over (order by sold) else 0 end
      + case when special then 1 else 0 end)::numeric, 3)::float as score
    from base order by score desc, views desc, sold desc, csc limit ${n}`;

  const [tot] = await sql<{ visitors: number; products: number }[]>`
    select count(distinct (visitor_id, csc))::int as visitors, count(distinct csc)::int as products
    from page_events where csc is not null and created_at > now() - interval '30 days'`;
  const cov = [25, 50, 100, 200, 300].filter((k) => k <= n).map((k) => {
    const v = rows.slice(0, k).reduce((a, r) => a + r.views, 0);
    return { top: k, product_page_visitors: v, share: tot.visitors ? +(v / tot.visitors).toFixed(3) : null };
  });
  show(`product-page visitors (30 days): ${tot.visitors} visitor-product pairs over ${tot.products} products; covered by the top N`, cov);
  show(`top ${rows.length}`, rows.map((r, i) => ({ rank: i + 1, csc: r.csc, name: r.name, size_ml: r.size_ml, category: r.category,
    price: r.current_price == null ? null : Number(r.current_price), views: r.views, watches: r.watches, sold: r.sold, special: r.special, score: r.score })));
  return sql.end();
}
