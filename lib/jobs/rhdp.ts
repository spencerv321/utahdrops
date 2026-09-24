import { sql } from "@/lib/db";
import { fetchRhdpDrawings } from "@/lib/dabs/rhdp";
import { withRun } from "./run";

/**
 * Records DABS RHDP drawings (products, bottles offered, entries). DABS only
 * keeps recent drawings on the page, so this builds our own history.
 */
export async function runRhdpJob() {
  return withRun("rhdp", async () => {
    const items = await fetchRhdpDrawings();
    if (items.length) {
      await sql`
        insert into rhdp_drawings ${sql(
          items.map((i) => ({
            drawing: i.drawing,
            item_code: i.itemCode,
            product_name: i.productName,
            price: i.price,
            bottles: i.bottles,
            entries: i.entries,
            section: i.section,
          })),
          "drawing", "item_code", "product_name", "price", "bottles", "entries", "section"
        )}
        on conflict (drawing, item_code) do update set
          product_name = excluded.product_name,
          price = excluded.price,
          bottles = coalesce(excluded.bottles, rhdp_drawings.bottles),
          entries = coalesce(excluded.entries, rhdp_drawings.entries),
          section = excluded.section,
          last_seen = now()`;
    }
    const bySection: Record<string, number> = {};
    for (const i of items) bySection[i.section] = (bySection[i.section] ?? 0) + 1;
    return { items: items.length, drawings: new Set(items.map((i) => i.drawing)).size, ...bySection };
  });
}
