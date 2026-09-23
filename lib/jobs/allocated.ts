import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { currentDropDate, fetchAllocatedList, type AllocatedRow } from "@/lib/dabs/allocated";
import { ScrapeShapeError } from "@/lib/dabs/client";
import { withRun } from "./run";

/** No list at all for this long means the page (or our parser) changed. */
const MAX_DAYS_WITHOUT_LIST = 40;

/**
 * Allocated & Rare pass. A list whose contents we haven't seen before means the
 * monthly list just posted: store it and emit an allocated_drop event, which
 * the digest turns into emails for opted-in users.
 *
 * Guards against re-announcing:
 *  - the drop date is inferred from the calendar, so a list that lingers past
 *    the rollover would otherwise be re-filed under next month as "new" — we
 *    skip any list whose content hash matches the last one we stored;
 *  - never announce a drop whose date has already passed (e.g. first run
 *    after an outage).
 */
export async function runAllocatedJob() {
  return withRun("allocated", async () => {
    const rows = await fetchAllocatedList();
    if (rows.length === 0) {
      const [last] = await sql<{ at: Date | null }[]>`
        select max(detected_at) as at from allocated_drops`;
      const days = last?.at ? (Date.now() - last.at.getTime()) / 86400_000 : 0;
      if (days > MAX_DAYS_WITHOUT_LIST) {
        throw new ScrapeShapeError(
          `no allocated list parsed for ${Math.floor(days)} days — check the page markup`
        );
      }
      return { rows: 0, new_rows: 0, note: "page empty (between drops)" };
    }

    const listHash = hashList(rows);
    const [previous] = await sql<{ list_hash: string }[]>`
      select detail->>'list_hash' as list_hash from scrape_runs
      where job = 'allocated' and ok = true and detail ? 'list_hash'
      order by started_at desc limit 1`;
    if (previous?.list_hash === listHash) {
      return { rows: rows.length, new_rows: 0, list_hash: listHash, note: "list unchanged" };
    }

    const dropDate = currentDropDate().toISOString().slice(0, 10);

    const inserts = rows.map((r) => ({
      drop_date: dropDate,
      product_name: r.productName,
      bottle_qty: r.bottleQty,
      price: r.price,
      store_text: r.storeText ?? "",
      county: r.county,
      drop_type: "allocated",
    }));

    const inserted = (await sql`
      insert into allocated_drops ${sql(
        inserts,
        "drop_date", "product_name", "bottle_qty", "price", "store_text", "county", "drop_type"
      )}
      on conflict (drop_date, product_name, store_text) do nothing
      returning product_name`) as unknown as { product_name: string }[];

    // Best-effort store resolution: exact match on the street-address part
    await sql`
      update allocated_drops d
      set store_id = s.id
      from stores s
      where d.store_id is null
        and d.store_text <> ''
        and s.address is not null
        and lower(split_part(d.store_text, ',', 1)) = lower(s.address)`;

    // One event per newly-seen product (not per store row), and only for
    // drops that haven't happened yet.
    const newProducts = [...new Set(inserted.map((r) => r.product_name))];
    const upcoming = dropDate >= todayInUtah();
    if (newProducts.length > 0 && upcoming) {
      await sql`
        insert into inventory_events (csc, event_type, detail)
        values (null, 'allocated_drop', ${sql.json({
          drop_date: dropDate,
          products: newProducts.slice(0, 100),
          count: newProducts.length,
        } as never)})`;
    }

    return {
      rows: rows.length,
      new_rows: inserted.length,
      new_products: newProducts.length,
      list_hash: listHash,
      ...(newProducts.length > 0 && !upcoming ? { note: `drop ${dropDate} already passed — not announced` } : {}),
    };
  });
}

function hashList(rows: AllocatedRow[]): string {
  const lines = rows
    .map((r) => [r.productName, r.storeText ?? "", r.bottleQty ?? "", r.price ?? ""].join("|").toUpperCase())
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

/** YYYY-MM-DD in Mountain Time. */
function todayInUtah(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
}
