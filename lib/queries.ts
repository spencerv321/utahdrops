import { sql } from "@/lib/db";

export interface ProductRow {
  csc: string;
  name: string;
  category: string | null;
  status: string | null;
  size_ml: number | null;
  current_price: string | null;
  warehouse_qty: number | null;
  store_qty: number | null;
  on_order_qty: number | null;
  in_stock: boolean;
  is_spa: boolean;
}

export interface SearchFilters {
  q?: string;
  category?: string;
  status?: string;
  inStock?: boolean;
  maxPrice?: number;
  sort?: "name" | "price_asc" | "price_desc" | "qty";
  page?: number;
}

const PAGE_SIZE = 50;

/**
 * Mirrors products.search_name: drop apostrophes ("maker's" → "makers"), turn
 * other punctuation into spaces, lowercase. Returns search tokens.
 */
export function searchTokens(q: string | undefined, max = 8): string[] {
  return (q ?? "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max);
}

export async function searchProducts(filters: SearchFilters) {
  const requested = Number.isFinite(filters.page) ? Number(filters.page) : 1;
  const page = Math.min(Math.max(0, requested - 1), 10_000);
  const tokens = searchTokens(filters.q);

  const where = sql`
    where true
    ${tokens.length > 0
      ? tokens.reduce(
          // Names often omit the style ("WELLER 12YR"), so a word may match the category.
          (acc, t) => sql`${acc} and (p.search_name like ${"%" + t + "%"} or lower(p.category) like ${"%" + t + "%"})`,
          sql``
        )
      : sql``}
    ${filters.category ? sql`and p.category = ${filters.category}` : sql``}
    ${filters.status ? sql`and p.status = ${filters.status}` : sql``}
    ${filters.inStock ? sql`and p.in_stock` : sql``}
    ${filters.maxPrice ? sql`and p.current_price <= ${filters.maxPrice}` : sql``}
  `;

  const orderBy =
    filters.sort === "price_asc" ? sql`p.current_price asc nulls last`
    : filters.sort === "price_desc" ? sql`p.current_price desc nulls last`
    : filters.sort === "qty" ? sql`p.store_qty desc nulls last`
    : filters.sort === "name" ? sql`p.search_name asc`
    // Best match: in-stock and widely stocked first, so the default list is
    // bottles people can actually buy rather than A→Z punctuation noise.
    : sql`p.in_stock desc, p.store_qty desc nulls last, p.search_name asc`;

  const rows = (await sql`
    select p.csc, p.name, p.category, p.status, p.size_ml, p.current_price::text,
           p.warehouse_qty, p.store_qty, p.on_order_qty, p.in_stock, p.is_spa,
           count(*) over ()::int as total
    from products p
    ${where}
    order by ${orderBy}
    limit ${PAGE_SIZE} offset ${page * PAGE_SIZE}`) as unknown as (ProductRow & { total: number })[];

  return {
    rows,
    total: rows[0]?.total ?? 0,
    page: page + 1,
    pageSize: PAGE_SIZE,
  };
}

export async function getCategories(): Promise<string[]> {
  const rows = (await sql`
    select distinct category from products
    where category is not null order by category`) as unknown as { category: string }[];
  return rows.map((r) => r.category);
}

export async function getProduct(csc: string) {
  const rows = (await sql`
    select csc, name, category, subcategory, status, size_ml, is_spa, description,
           current_price::text, warehouse_qty, store_qty, on_order_qty, in_stock,
           price_percentile_in_category::float8 as price_percentile,
           first_seen, last_seen, last_store_scrape, delisted_at
    from products where csc = ${csc}`) as unknown as (ProductRow & {
    delisted_at: Date | null;
    subcategory: string | null;
    description: string | null;
    price_percentile: number | null;
    first_seen: Date;
    last_seen: Date;
    last_store_scrape: Date | null;
  })[];
  return rows[0] ?? null;
}

export interface SnapshotPoint {
  scraped_at: Date;
  warehouse_qty: number | null;
  store_qty: number | null;
  price: string | null;
}

export async function getProductHistory(csc: string, days = 90): Promise<SnapshotPoint[]> {
  return (await sql`
    select scraped_at, warehouse_qty, store_qty, price::text
    from inventory_snapshots
    where csc = ${csc} and scraped_at > now() - make_interval(days => ${days})
    order by scraped_at asc`) as unknown as SnapshotPoint[];
}

export interface StoreAvailability {
  store_id: number;
  qty: number;
  scraped_at: Date;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

export async function getStoreAvailability(csc: string): Promise<StoreAvailability[]> {
  return (await sql`
    select c.store_id, c.qty, c.scraped_at, s.name, s.address, s.city, s.phone, s.lat, s.lng
    from store_inventory_current c
    join stores s on s.id = c.store_id
    where c.csc = ${csc}
    order by c.qty desc, s.id asc`) as unknown as StoreAvailability[];
}

export interface EventRow {
  id: number;
  csc: string | null;
  event_type: string;
  detail: Record<string, unknown>;
  created_at: Date;
  name: string | null;
  category: string | null;
  status: string | null;
  current_price: string | null;
  in_stock: boolean | null;
}

export async function getEvents(type?: string, limit = 100): Promise<EventRow[]> {
  return (await sql`
    select e.id, e.csc, e.event_type, e.detail, e.created_at,
           p.name, p.category, p.status, p.current_price::text, p.in_stock
    from inventory_events e
    left join products p using (csc)
    ${type ? sql`where e.event_type = ${type}` : sql`where e.event_type <> 'store_restock'`}
    order by e.created_at desc
    limit ${limit}`) as unknown as EventRow[];
}

export interface DropRow {
  drop_date: string;
  product_name: string;
  bottle_qty: number | null;
  price: string | null;
  store_text: string | null;
  county: string | null;
  csc: string | null;
}

export async function getDrops(): Promise<DropRow[]> {
  return (await sql`
    select drop_date::text, product_name, bottle_qty, price::text, store_text, county, csc
    from allocated_drops
    order by drop_date desc, product_name asc, store_text asc
    limit 1000`) as unknown as DropRow[];
}

/** Freshness for the "as of" labels: when did the last successful catalog pass finish? */
export async function getFreshness(): Promise<Date | null> {
  const rows = (await sql`
    select finished_at from scrape_runs
    where job = 'catalog' and ok = true
    order by finished_at desc limit 1`) as unknown as { finished_at: Date }[];
  return rows[0]?.finished_at ?? null;
}

/** Catalog freshness plus whether it's older than `staleAfterHours`. */
export async function getDataStaleness(staleAfterHours = 24) {
  const freshness = await getFreshness();
  const stale = !freshness || Date.now() - freshness.getTime() > staleAfterHours * 3600_000;
  return { freshness, stale };
}

export type FeedEvent = EventRow & { size_ml: number | null; store_qty: number | null };

/**
 * Home "Just happened" feed: the latest change per product, minus noise
 * (special orders, cheap RTD packs and cans, products nobody can buy), so a
 * catalog pass full of vodka-seltzer restocks doesn't bury the bourbon.
 * Widens the window when a quiet week leaves too little to show.
 */
export async function getHomeFeed(limit = 12): Promise<FeedEvent[]> {
  for (const days of [7, 30]) {
    const rows = (await sql`
      select * from (
        select distinct on (e.csc)
               e.id, e.csc, e.event_type, e.detail, e.created_at,
               p.name, p.category, p.status, p.current_price::text, p.in_stock,
               p.size_ml, p.store_qty
        from inventory_events e
        join products p using (csc)
        where e.created_at > now() - make_interval(days => ${days})
          and e.event_type in ('restock', 'new_product', 'price_change', 'status_change')
          and p.delisted_at is null
          and coalesce(p.status, '') not in ('S', 'N', 'X')
          and coalesce(p.category, '') not like 'SPECIAL ORDERS%'
          and coalesce(p.current_price, 0) >= 20
          and coalesce(p.size_ml, 750) >= 375
          and p.search_name !~ '(\\m\\d+ ?pk\\M|variety|\\mrtd\\M|\\mcans?\\M|seltzer)'
          -- only real price drops (DABS also shaves cents off, and raises prices)
          and (e.event_type <> 'price_change'
               or (e.detail->>'new')::numeric <= (e.detail->>'old')::numeric * 0.95)
          -- a status change only matters when it's news: clearance or allocation
          and (e.event_type <> 'status_change' or e.detail->>'new' in ('D', 'A', 'L'))
          -- restocks of things that are gone again aren't actionable
          and (e.event_type <> 'restock' or p.in_stock)
        order by e.csc, e.created_at desc
      ) latest
      order by created_at desc
      limit ${limit}`) as unknown as FeedEvent[];
    if (rows.length >= 4 || days === 30) return rows;
  }
  return [];
}

/** Which of these products the signed-in user already watches. */
export async function getWatchedSet(userId: string | undefined, cscs: string[]): Promise<Set<string>> {
  if (!userId || cscs.length === 0) return new Set();
  const rows = (await sql`
    select csc from watchlist where user_id = ${userId} and csc = any(${cscs})`) as unknown as { csc: string }[];
  return new Set(rows.map((r) => r.csc));
}

/** Bottles on the list for a given drop date (0 until DABS posts it). */
export async function getDropListSize(dropDate: string): Promise<number> {
  const [row] = (await sql`
    select count(distinct product_name)::int as n from allocated_drops
    where drop_date = ${dropDate}`) as unknown as { n: number }[];
  return row?.n ?? 0;
}

/** Recent changes to one product, newest first, for its history timeline. */
export async function getProductEvents(csc: string, limit = 8): Promise<EventRow[]> {
  return (await sql`
    select e.id, e.csc, e.event_type, e.detail, e.created_at,
           null as name, null as category, null as status, null as current_price, null as in_stock
    from inventory_events e
    where e.csc = ${csc} and e.event_type <> 'store_restock'
    order by e.created_at desc
    limit ${limit}`) as unknown as EventRow[];
}

/** The signed-in user's home stores ("my stores"), in the order they picked them. */
export async function getUserStoreIds(userId: string | undefined): Promise<number[]> {
  if (!userId) return [];
  const rows = (await sql`
    select store_id from user_stores where user_id = ${userId} order by created_at`) as unknown as {
    store_id: number;
  }[];
  return rows.map((r) => r.store_id);
}
