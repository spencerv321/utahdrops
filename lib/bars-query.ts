import { sql } from "@/lib/db";
import { BAR_TYPES } from "@/lib/bars";
import { MAKERS } from "@/lib/makers";

export interface BarRow {
  license_number: string;
  type: string;
  business_name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  original_issue_date: string | null;
  new_this_month: boolean;
}

/** Active bar-type licenses (see BAR_GROUPS), plus when the list was last pulled. */
export async function getBars(): Promise<{ rows: BarRow[]; pulledAt: Date | null }> {
  const [rows, runs] = await Promise.all([
    sql`
      select license_number, type, business_name, address, city, county,
             original_issue_date::text, new_this_month
      from licensees
      where removed_at is null and type = any(${BAR_TYPES})
      order by county nulls last, city nulls last, business_name`,
    sql`select max(started_at) as at from scrape_runs where job = 'licensees' and ok`,
  ]);
  return { rows: rows as unknown as BarRow[], pulledAt: (runs[0] as { at: Date | null } | undefined)?.at ?? null };
}

// "445 S 400 W" from "445 S 400 W, SALT LAKE CITY, UT …": house number and street, for matching makers.
const streetKey = (s: string) =>
  s.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").split(",")[0].trim().split(" ").slice(0, 4).join(" ");

const MAKER_BY_ADDRESS = new Map(
  MAKERS.flatMap((m) => m.places.filter((p) => /^\d/.test(p.address)).map((p) => [`${streetKey(p.address)}|${p.city}`, m] as const))
);

/** The maker whose listed place is at this license's address, if any. */
export function makerAt(row: Pick<BarRow, "address" | "city">) {
  if (!row.address || !row.city) return undefined;
  return MAKER_BY_ADDRESS.get(`${streetKey(row.address)}|${row.city}`);
}
