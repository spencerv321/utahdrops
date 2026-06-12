import { sql } from "@/lib/db";
import { currentDropDate, fetchAllocatedList } from "@/lib/dabs/allocated";
import { withRun } from "./run";

/**
 * Allocated & Rare pass. New rows (vs the unique key drop_date+name+store)
 * mean the monthly list just posted — emit allocated_drop events, which the
 * alert job turns into immediate emails for opted-in users.
 */
export async function runAllocatedJob() {
  return withRun("allocated", async () => {
    const rows = await fetchAllocatedList();
    if (rows.length === 0) return { rows: 0, new_rows: 0, note: "page empty (between drops)" };

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

    // Best-effort store resolution: match the leading street number + first street word
    await sql`
      update allocated_drops d
      set store_id = s.id
      from stores s
      where d.store_id is null
        and d.store_text <> ''
        and s.address is not null
        and lower(split_part(d.store_text, ',', 1)) = lower(s.address)`;

    // One event per newly-seen product (not per store row)
    const newProducts = [...new Set(inserted.map((r) => r.product_name))];
    if (newProducts.length > 0) {
      await sql`
        insert into inventory_events (csc, event_type, detail)
        values (null, 'allocated_drop', ${sql.json({
          drop_date: dropDate,
          products: newProducts.slice(0, 100),
          count: newProducts.length,
        } as never)})`;
    }

    return { rows: rows.length, new_rows: inserted.length, new_products: newProducts.length };
  });
}
