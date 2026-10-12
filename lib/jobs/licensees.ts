import { sql } from "@/lib/db";
import { MIN_LICENSEES, type Licensee } from "@/lib/licensees";
import { withRun } from "./run";

/**
 * Store one full pull of the DABS Licensee List. Upserts every license,
 * clears removed_at for ones that came back, and marks licenses missing from
 * this pull as removed (never deletes). Refuses a pull that looks broken.
 */
export async function runLicenseesJob(rows: Licensee[]) {
  return withRun("licensees", async () => {
    if (rows.length < MIN_LICENSEES) {
      throw new Error(`licensees: only ${rows.length} rows (expected at least ${MIN_LICENSEES}); not saving`);
    }
    const ids = new Set(rows.map((r) => r.license_number));
    if (ids.size !== rows.length || ids.has("")) throw new Error("licensees: missing or duplicate license numbers");

    const [{ now }] = (await sql`select now() as now`) as unknown as { now: Date }[];
    const [{ before }] = (await sql`select count(*)::int as before from licensees`) as unknown as { before: number }[];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, last_seen: now }));
      await sql`
        insert into licensees ${sql(
          chunk,
          "license_number", "category", "type", "business_name", "address", "city", "county",
          "original_issue_date", "conditional_approval", "new_this_month", "last_seen"
        )}
        on conflict (license_number) do update set
          category = excluded.category, type = excluded.type, business_name = excluded.business_name,
          address = excluded.address, city = excluded.city, county = excluded.county,
          original_issue_date = excluded.original_issue_date,
          conditional_approval = excluded.conditional_approval,
          new_this_month = excluded.new_this_month,
          last_seen = excluded.last_seen, removed_at = null`;
    }
    const removed = (await sql`
      update licensees set removed_at = ${now}
      where removed_at is null and last_seen < ${now}
      returning license_number`) as unknown as unknown[];
    const [{ after }] = (await sql`select count(*)::int as after from licensees`) as unknown as { after: number }[];
    return { rows: rows.length, added: after - before, removed: removed.length };
  });
}
