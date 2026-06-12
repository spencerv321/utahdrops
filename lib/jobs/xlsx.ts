import { sql } from "@/lib/db";
import { fetchProductListXlsx } from "@/lib/dabs/xlsx";
import { withRun } from "./run";

/**
 * Monthly product-list ingest. Seeds/refreshes catalog facts the locator API
 * doesn't return (size, class codes, SPA flag). Never touches quantities —
 * the catalog scrape owns those.
 */
export async function runXlsxJob(url?: string) {
  return withRun("xlsx", async () => {
    const rows = await fetchProductListXlsx(url);

    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000).map((r) => ({
        csc: r.csc,
        name: r.name,
        category: r.category,
        subcategory: r.subcategory,
        size_ml: r.sizeMl,
        status: r.status,
        is_spa: r.isSpa,
        current_price: r.price,
      }));
      await sql`
        insert into products ${sql(
          chunk,
          "csc", "name", "category", "subcategory", "size_ml", "status", "is_spa", "current_price"
        )}
        on conflict (csc) do update set
          subcategory = coalesce(excluded.subcategory, products.subcategory),
          size_ml = coalesce(excluded.size_ml, products.size_ml),
          is_spa = excluded.is_spa,
          last_seen = now()`;
    }

    return { rows: rows.length };
  });
}
