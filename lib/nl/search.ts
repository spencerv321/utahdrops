import { sql } from "@/lib/db";
import { geocodeUtah } from "./geocode";
import type { ParsedQuery } from "./parse";

export interface NlProduct {
  csc: string;
  name: string;
  category: string | null;
  status: string | null;
  current_price: string | null;
  store_qty: number | null;
  in_stock: boolean;
  price_percentile: number | null;
  qty_at_store?: number;
}

export interface NlStoreGroup {
  store_id: number;
  store_name: string;
  city: string | null;
  address: string | null;
  distance_mi: number;
  products: NlProduct[];
}

export interface NlResult {
  mode: "stores" | "statewide";
  interpretation: string[];
  products: NlProduct[];
  stores: NlStoreGroup[];
}

function filtersFrom(parsed: ParsedQuery) {
  const tierFilter =
    parsed.price_tier === "top_quartile" ? sql`and p.price_percentile_in_category >= 75`
    : parsed.price_tier === "above_median" ? sql`and p.price_percentile_in_category >= 50`
    : parsed.price_tier === "below_median" ? sql`and p.price_percentile_in_category < 50`
    : parsed.price_tier === "bottom_quartile" ? sql`and p.price_percentile_in_category < 25`
    : sql``;

  const statusFilter =
    parsed.status_filter === "in_stock" ? sql`and p.in_stock`
    : parsed.status_filter === "discontinued_clearance" ? sql`and p.status = 'D' and p.store_qty > 0`
    : parsed.status_filter === "allocated" ? sql`and p.status in ('A', 'L')`
    : sql``;

  return sql`
    ${parsed.categories.length > 0 ? sql`and p.category = any(${parsed.categories})` : sql``}
    ${parsed.name_terms.length > 0
      ? parsed.name_terms.reduce(
          (acc, t) => sql`${acc} and p.name ilike ${"%" + t + "%"}`,
          sql``
        )
      : sql``}
    ${parsed.price_min != null ? sql`and p.current_price >= ${parsed.price_min}` : sql``}
    ${parsed.price_max != null ? sql`and p.current_price <= ${parsed.price_max}` : sql``}
    ${tierFilter}
    ${statusFilter}
    and p.category not like 'SPECIAL ORDERS%'
  `;
}

const orderFor = (parsed: ParsedQuery) =>
  parsed.sort === "price_asc" ? sql`p.current_price asc nulls last`
  : parsed.sort === "price_desc" ? sql`p.current_price desc nulls last`
  : parsed.sort === "qty" ? sql`p.store_qty desc nulls last`
  : sql`coalesce(p.price_percentile_in_category, 50) desc, p.store_qty desc nulls last`;

export async function runNlSearch(
  parsed: ParsedQuery,
  coords?: { lat: number; lng: number } | null
): Promise<NlResult> {
  const interpretation = describe(parsed);

  // Resolve a location: browser coords win, then geocoded text.
  let point = coords ?? null;
  if (!point && parsed.location_text && parsed.location_text !== "NEAR_ME") {
    point = await geocodeUtah(parsed.location_text);
  }

  if (point) {
    const nearest = (await sql`
      select id, name, city, address,
             3959 * acos(
               least(1.0,
                 cos(radians(${point.lat})) * cos(radians(lat)) *
                 cos(radians(lng) - radians(${point.lng})) +
                 sin(radians(${point.lat})) * sin(radians(lat))
               )
             ) as distance_mi
      from stores
      where lat is not null
      order by distance_mi asc
      limit 3`) as unknown as {
      id: number; name: string; city: string | null; address: string | null; distance_mi: number;
    }[];

    const storeGroups: NlStoreGroup[] = [];
    for (const store of nearest) {
      const products = (await sql`
        select p.csc, p.name, p.category, p.status, p.current_price::text,
               p.store_qty, p.in_stock,
               p.price_percentile_in_category::float8 as price_percentile,
               c.qty as qty_at_store
        from store_inventory_current c
        join products p using (csc)
        where c.store_id = ${store.id} and c.qty > 0
        ${filtersFrom(parsed)}
        order by ${orderFor(parsed)}
        limit ${parsed.limit}`) as unknown as NlProduct[];
      storeGroups.push({
        store_id: store.id,
        store_name: store.name,
        city: store.city,
        address: store.address,
        distance_mi: Math.round(store.distance_mi * 10) / 10,
        products,
      });
    }

    // If per-store coverage hasn't reached these products yet, degrade
    // gracefully to statewide rather than implying "not available".
    if (storeGroups.every((g) => g.products.length === 0)) {
      const statewide = await statewideQuery(parsed);
      return {
        mode: "statewide",
        interpretation: [...interpretation, "no per-store data yet — showing statewide"],
        products: statewide,
        stores: [],
      };
    }
    return { mode: "stores", interpretation, products: [], stores: storeGroups };
  }

  const products = await statewideQuery(parsed);
  return { mode: "statewide", interpretation, products, stores: [] };
}

async function statewideQuery(parsed: ParsedQuery): Promise<NlProduct[]> {
  return (await sql`
    select p.csc, p.name, p.category, p.status, p.current_price::text,
           p.store_qty, p.in_stock,
           p.price_percentile_in_category::float8 as price_percentile
    from products p
    where true
    ${filtersFrom(parsed)}
    order by ${orderFor(parsed)}
    limit ${parsed.limit}`) as unknown as NlProduct[];
}

/** Human-readable interpretation chips so users can correct the parse. */
function describe(parsed: ParsedQuery): string[] {
  const chips: string[] = [];
  if (parsed.categories.length > 0) {
    chips.push(
      parsed.categories.length <= 3
        ? parsed.categories.join(", ")
        : `${parsed.categories.length} categories`
    );
  }
  if (parsed.name_terms.length > 0) chips.push(`name contains “${parsed.name_terms.join(", ")}”`);
  if (parsed.price_tier === "top_quartile") chips.push("top 25% price");
  if (parsed.price_tier === "above_median") chips.push("above-median price");
  if (parsed.price_tier === "below_median") chips.push("below-median price");
  if (parsed.price_tier === "bottom_quartile") chips.push("budget");
  if (parsed.price_min != null) chips.push(`$${parsed.price_min}+`);
  if (parsed.price_max != null) chips.push(`under $${parsed.price_max}`);
  if (parsed.status_filter === "in_stock") chips.push("in stock");
  if (parsed.status_filter === "discontinued_clearance") chips.push("clearance (D status)");
  if (parsed.status_filter === "allocated") chips.push("allocated/limited");
  if (parsed.location_text === "NEAR_ME") chips.push("near you");
  else if (parsed.location_text) chips.push(`near ${parsed.location_text}`);
  return chips;
}
