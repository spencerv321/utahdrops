import { sql } from "@/lib/db";
import { withRun } from "./run";

/** Nightly: price percentile within category — powers NL "high end"/"cheap" tiers. */
export async function runPercentilesJob() {
  return withRun("percentiles", async () => {
    const updated = await sql<{ count: string }[]>`
      with ranked as (
        select csc,
               percent_rank() over (partition by category order by current_price) * 100 as pct
        from products
        where current_price is not null and category is not null
      ),
      done as (
        update products p
        set price_percentile_in_category = round(r.pct::numeric, 2)
        from ranked r
        where p.csc = r.csc
        returning 1
      )
      select count(*)::text as count from done`;
    return { updated: Number(updated[0].count) };
  });
}
