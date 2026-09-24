import { sql } from "@/lib/db";
import { fetchFullCatalog, type CatalogRow } from "@/lib/dabs/catalog";
import { cleanName, parseSizeMl, parseStatusCode, ScrapeShapeError } from "@/lib/dabs/client";
import { withRun, lastSuccessfulRun } from "./run";

interface ExistingProduct {
  csc: string;
  name: string;
  category: string | null;
  status: string | null;
  is_spa: boolean;
  current_price: string | null;
  warehouse_qty: number | null;
  store_qty: number | null;
  on_order_qty: number | null;
  in_stock: boolean;
}

type EventInsert = {
  csc: string;
  event_type: string;
  detail: Record<string, unknown>;
};

type Product = ReturnType<typeof normalizeProduct>;

/**
 * If the previous successful pass is older than this, the diff spans too much
 * time to present as "what just changed" — treat the pass as a re-bootstrap.
 */
const CATCH_UP_GAP_MS = 48 * 3600_000;

/**
 * DABS occasionally serves a pass where thousands of in-stock products report
 * store_qty 0 (seen 2026-09-23: ~3k, e.g. Fireball 4,198 → 0 → 4,471 thirty
 * minutes later). Real statewide sell-outs are a few dozen per pass, so a
 * pass with more drops-to-zero than this is rejected before writing anything.
 */
const MAX_DROPS_TO_ZERO = 200;
const MAX_DROPS_TO_ZERO_FRACTION = 0.02;

/**
 * Full catalog pass: upsert changed products, write delta-encoded statewide
 * snapshots, and diff against previous state to emit inventory_events.
 *
 * The diff runs in memory against the products table (which always holds the
 * latest observation), so cost scales with what changed — never with the size
 * of the snapshot history.
 *
 * Events are suppressed on the very first run (28k "new products" would poison
 * the what's-new feed) and after a long outage (weeks of drift would all be
 * announced as fresh restocks).
 */
export async function runCatalogJob() {
  const lastOk = await lastSuccessfulRun("catalog");
  return withRun("catalog", async () => {
    const rows = await fetchFullCatalog();

    const existing = await sql<ExistingProduct[]>`
      select csc, name, category, status, is_spa, current_price::text,
             warehouse_qty, store_qty, on_order_qty, in_stock
      from products`;
    const byCsc = new Map(existing.map((p) => [p.csc, p]));

    const bootstrap = existing.length === 0 || lastOk == null;
    const catchUp = !bootstrap && Date.now() - lastOk.getTime() > CATCH_UP_GAP_MS;
    const emitEvents = !bootstrap && !catchUp;

    const products = rows.map((row) => normalizeProduct(row));
    const events: EventInsert[] = [];
    const changed: Product[] = [];
    const snapshots: Product[] = [];

    let dropsToZero = 0;
    let previouslyInStock = 0;
    for (const p of products) {
      const prev = byCsc.get(p.csc);
      if (prev && (prev.store_qty ?? 0) > 0) {
        previouslyInStock++;
        if ((p.store_qty ?? 0) === 0) dropsToZero++;
      }
    }
    const dropLimit = Math.max(MAX_DROPS_TO_ZERO, previouslyInStock * MAX_DROPS_TO_ZERO_FRACTION);
    if (!bootstrap && dropsToZero > dropLimit) {
      throw new ScrapeShapeError(
        `${dropsToZero} of ${previouslyInStock} in-stock products dropped to 0 in one pass (limit ${Math.round(dropLimit)}) — likely a partial DABS response; not writing`
      );
    }

    for (const p of products) {
      const prev = byCsc.get(p.csc);
      if (!prev) {
        changed.push(p);
        snapshots.push(p);
        events.push({
          csc: p.csc,
          event_type: "new_product",
          detail: { name: p.name, price: p.current_price, status: p.status },
        });
        continue;
      }

      const prevPrice = prev.current_price != null ? parseFloat(prev.current_price) : null;
      const snapshotChanged =
        prevPrice !== p.current_price ||
        prev.warehouse_qty !== p.warehouse_qty ||
        prev.store_qty !== p.store_qty ||
        prev.on_order_qty !== p.on_order_qty;
      const rowChanged =
        snapshotChanged ||
        prev.name !== p.name ||
        prev.category !== p.category ||
        prev.status !== p.status ||
        prev.is_spa !== p.is_spa ||
        prev.in_stock !== p.in_stock;
      if (snapshotChanged) snapshots.push(p);
      if (rowChanged) changed.push(p);

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

    // Upsert only rows that changed — unchanged rows just get last_seen bumped.
    for (const chunk of chunks(changed, 1000)) {
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
          delisted_at = null,
          last_seen = now()`;
    }

    const changedSet = new Set(changed.map((p) => p.csc));
    const unchanged = products.filter((p) => !changedSet.has(p.csc)).map((p) => p.csc);
    for (const chunk of chunks(unchanged, 5000)) {
      await sql`update products set last_seen = now(), delisted_at = null where csc = any(${chunk})`;
    }

    // Products DABS stopped listing. Require ~a day of absence (3 passes) so a
    // single short fetch can't mass-delist; they stay searchable but show as
    // no longer listed and out of stock.
    const [{ delisted }] = await sql<{ delisted: number }[]>`
      with d as (
        update products
        set delisted_at = now(), in_stock = false
        where delisted_at is null
          and last_seen < now() - interval '24 hours'
        returning 1
      )
      select count(*)::int as delisted from d`;

    // Delta-encoded snapshots: products always hold the previous observation,
    // so "changed vs products" is exactly "changed vs latest snapshot".
    for (const chunk of chunks(snapshots, 1000)) {
      await sql`
        insert into inventory_snapshots ${sql(
          chunk.map((p) => ({
            csc: p.csc,
            scraped_at: new Date(),
            warehouse_qty: p.warehouse_qty,
            store_qty: p.store_qty,
            on_order_qty: p.on_order_qty,
            price: p.current_price,
          })),
          "csc", "scraped_at", "warehouse_qty", "store_qty", "on_order_qty", "price"
        )}`;
    }

    if (emitEvents) {
      for (const chunk of chunks(events, 1000)) {
        await sql`
          insert into inventory_events ${sql(
            chunk.map((e) => ({ ...e, detail: sql.json(e.detail as never) })),
            "csc", "event_type", "detail"
          )}`;
      }
    }

    // A product back in stores gets its store-by-store check right away: clear
    // any failure backoff (DABS's detail page often errors while a SKU is out
    // everywhere), so the next store run picks it up instead of up to 72h later.
    const backInStock = products
      .filter((p) => (p.store_qty ?? 0) > 0 && (byCsc.get(p.csc)?.store_qty ?? 0) === 0)
      .map((p) => p.csc);
    if (backInStock.length > 0) {
      await sql`update products set store_retry_at = null where csc = any(${backInStock}) and store_retry_at is not null`;
    }

    return {
      fetched: rows.length,
      changed: changed.length,
      delisted,
      snapshots_written: snapshots.length,
      events: emitEvents ? events.length : 0,
      ...(emitEvents
        ? {}
        : {
            events_suppressed: events.length,
            reason: bootstrap ? "bootstrap" : `catch-up after gap since ${lastOk?.toISOString()}`,
          }),
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
