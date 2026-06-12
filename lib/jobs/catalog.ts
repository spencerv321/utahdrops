import { sql } from "@/lib/db";
import { fetchFullCatalog, type CatalogRow } from "@/lib/dabs/catalog";
import { cleanName, parseSizeMl, parseStatusCode } from "@/lib/dabs/client";
import { withRun } from "./run";

interface ExistingProduct {
  csc: string;
  status: string | null;
  current_price: string | null;
  store_qty: number | null;
}

type EventInsert = {
  csc: string;
  event_type: string;
  detail: Record<string, unknown>;
};

/**
 * Full catalog pass: upsert products, write delta-encoded statewide
 * snapshots, and diff against previous state to emit inventory_events.
 * On the very first run (empty table) events are suppressed — 28k
 * "new products" on bootstrap would poison the what's-new feed.
 */
export async function runCatalogJob() {
  return withRun("catalog", async () => {
    const rows = await fetchFullCatalog();
    const scrapedAt = new Date();

    const existing = await sql<ExistingProduct[]>`
      select csc, status, current_price::text, store_qty from products`;
    const bootstrap = existing.length === 0;
    const byCsc = new Map(existing.map((p) => [p.csc, p]));

    const events: EventInsert[] = [];
    const products = rows.map((row) => normalizeProduct(row));

    if (!bootstrap) {
      for (const p of products) {
        const prev = byCsc.get(p.csc);
        if (!prev) {
          events.push({
            csc: p.csc,
            event_type: "new_product",
            detail: { name: p.name, price: p.current_price, status: p.status },
          });
          continue;
        }
        const prevPrice = prev.current_price ? parseFloat(prev.current_price) : null;
        if (p.current_price != null && prevPrice != null && p.current_price !== prevPrice) {
          events.push({
            csc: p.csc,
            event_type: "price_change",
            detail: { name: p.name, old: prevPrice, new: p.current_price },
          });
        }
        if (p.status && prev.status && p.status !== prev.status) {
          events.push({
            csc: p.csc,
            event_type: "status_change",
            detail: { name: p.name, old: prev.status, new: p.status },
          });
        }
        const prevQty = prev.store_qty ?? 0;
        const newQty = p.store_qty ?? 0;
        if (prevQty === 0 && newQty > 0) {
          events.push({
            csc: p.csc,
            event_type: "restock",
            detail: { name: p.name, qty: newQty, scope: "statewide" },
          });
        } else if (prevQty > 0 && newQty === 0) {
          events.push({
            csc: p.csc,
            event_type: "out_of_stock",
            detail: { name: p.name, scope: "statewide" },
          });
        }
      }
    }

    // Upsert products in chunks
    for (const chunk of chunks(products, 1000)) {
      await sql`
        insert into products ${sql(
          chunk,
          "csc", "name", "category", "status", "size_ml", "is_spa",
          "current_price", "warehouse_qty", "store_qty", "on_order_qty", "in_stock"
        )}
        on conflict (csc) do update set
          name = excluded.name,
          category = excluded.category,
          status = excluded.status,
          size_ml = coalesce(products.size_ml, excluded.size_ml),
          is_spa = excluded.is_spa,
          current_price = excluded.current_price,
          warehouse_qty = excluded.warehouse_qty,
          store_qty = excluded.store_qty,
          on_order_qty = excluded.on_order_qty,
          in_stock = excluded.in_stock,
          last_seen = now()`;
    }

    // Delta-encoded snapshots: only rows whose tracked values changed
    const snapshotRows = await sql<{ count: string }[]>`
      with latest as (
        select distinct on (csc) csc, warehouse_qty, store_qty, on_order_qty, price
        from inventory_snapshots order by csc, scraped_at desc
      ),
      incoming as (
        select csc, warehouse_qty, store_qty, on_order_qty, current_price as price
        from products where last_seen >= ${scrapedAt}
      ),
      inserted as (
        insert into inventory_snapshots (csc, scraped_at, warehouse_qty, store_qty, on_order_qty, price)
        select i.csc, now(), i.warehouse_qty, i.store_qty, i.on_order_qty, i.price
        from incoming i
        left join latest l using (csc)
        where l.csc is null
           or l.warehouse_qty is distinct from i.warehouse_qty
           or l.store_qty is distinct from i.store_qty
           or l.on_order_qty is distinct from i.on_order_qty
           or l.price is distinct from i.price
        returning 1
      )
      select count(*)::text as count from inserted`;

    if (events.length > 0) {
      for (const chunk of chunks(events, 1000)) {
        await sql`
          insert into inventory_events ${sql(
            chunk.map((e) => ({ ...e, detail: sql.json(e.detail as never) })),
            "csc", "event_type", "detail"
          )}`;
      }
    }

    return {
      fetched: rows.length,
      bootstrap,
      snapshots_written: Number(snapshotRows[0].count),
      events: events.length,
    };
  });
}

function normalizeProduct(row: CatalogRow) {
  const name = cleanName(row.name);
  return {
    csc: row.sku,
    name,
    category: row.displayGroup ? cleanName(row.displayGroup) : null,
    status: parseStatusCode(row.status),
    size_ml: parseSizeMl(name),
    is_spa: row.onSpa ?? false,
    current_price: row.currentPrice ?? null,
    warehouse_qty: row.warehouseQty ?? null,
    store_qty: row.storeQty ?? null,
    on_order_qty: row.onOrderQty ?? null,
    in_stock: row.inStock ?? ((row.storeQty ?? 0) > 0),
  };
}

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
