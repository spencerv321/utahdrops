import { createHash } from "node:crypto";
import { cachedQuery } from "@/lib/cached-query";
import { sql } from "@/lib/db";
import type { ProductRow } from "@/lib/queries";
import { MAKERS, type Maker } from "@/lib/makers";

/**
 * A maker's bottles in the DABS catalog: products DABS lists under the
 * maker's vendor code (monthly product list, `products.vendor_code`) or whose
 * name starts with one of the maker's reviewed brand prefixes. Mirrors
 * makerForProduct() in lib/makers.ts.
 */
function matchClause(maker: Maker) {
  const vendors = maker.catalog.vendors ?? [];
  const prefixes = (maker.catalog.prefixes ?? []).map((p) => p.replace(/[\\%_]/g, "\\$&") + "%");
  const exclude = maker.catalog.exclude ?? [];
  return sql`(p.vendor_code = any(${vendors}) or upper(p.name) like any(${prefixes}))
             and not (p.csc = any(${exclude}))`;
}

/** On a store shelf, or a regular listing that can come back; not special orders or retired codes. */
const ON_SHELVES = sql`(p.in_stock
  or (p.delisted_at is null and coalesce(p.category, '') not like 'SPECIAL ORDERS%'
      and coalesce(p.status, '') not in ('N', 'S', 'U', 'X')))`;

export interface MakerProducts {
  /** In stock, or regularly listed (may be out right now). In stock first. */
  listed: ProductRow[];
  /** Special orders, delisted and discontinued listings: counted, shown on request. */
  other: ProductRow[];
}

export async function getMakerProducts(maker: Maker): Promise<MakerProducts> {
  if (!maker.catalog.vendors?.length && !maker.catalog.prefixes?.length) return { listed: [], other: [] };
  const rows = (await sql`
    select p.csc, p.name, p.category, p.status, p.size_ml, p.current_price::text,
           p.warehouse_qty, p.store_qty, p.on_order_qty, p.in_stock, p.is_spa,
           ${ON_SHELVES} as listed
    from products p
    where ${matchClause(maker)}
    order by p.in_stock desc, p.store_qty desc nulls last, p.name asc
    limit 400`) as unknown as (ProductRow & { listed: boolean })[];
  return { listed: rows.filter((r) => r.listed), other: rows.filter((r) => !r.listed) };
}

/**
 * For the index: bottles on store shelves per maker slug (statewide, latest
 * catalog pass). Cached for an hour: the query matches every maker's prefixes
 * against the whole catalog (~0.7s locally, ~2s in production) and the
 * statewide counts only change 3 times a day.
 */
export async function getMakerShelfCounts(): Promise<Map<string, number>> {
  return new Map(await cachedShelfCounts());
}

// Entries, not a Map: the cache stores JSON. The key carries a fingerprint of
// the makers' catalog rules, because Vercel's data cache outlives deploys and a
// changed matcher must not show the old counts.
const MATCHERS_KEY = createHash("sha1")
  .update(JSON.stringify(MAKERS.map((m) => [m.slug, m.catalog])))
  .digest("hex")
  .slice(0, 12);
const cachedShelfCounts = cachedQuery(
  async () => [...(await queryMakerShelfCounts())],
  ["maker-shelf-counts", MATCHERS_KEY],
  3600
);

async function queryMakerShelfCounts(): Promise<Map<string, number>> {
  const pairs = MAKERS.flatMap((m) => [
    ...(m.catalog.vendors ?? []).map((v) => [m.slug, "v", v]),
    ...(m.catalog.prefixes ?? []).map((pre) => [m.slug, "p", pre.replace(/[\\%_]/g, "\\$&") + "%"]),
  ]);
  if (pairs.length === 0) return new Map();
  const excluded = MAKERS.flatMap((m) => (m.catalog.exclude ?? []).map((csc) => `${m.slug}:${csc}`));
  const rows = (await sql`
    with m(slug, kind, val) as (
      select * from unnest(${pairs.map((p) => p[0])}::text[], ${pairs.map((p) => p[1])}::text[], ${pairs.map((p) => p[2])}::text[])
    )
    select m.slug, count(distinct p.csc)::int as n
    from m
    join products p on (m.kind = 'v' and p.vendor_code = m.val) or (m.kind = 'p' and upper(p.name) like m.val)
    where p.in_stock and coalesce(p.store_qty, 0) > 0
      and not ((m.slug || ':' || p.csc) = any(${excluded}))
    group by m.slug`) as unknown as { slug: string; n: number }[];
  return new Map(rows.map((r) => [r.slug, r.n]));
}
