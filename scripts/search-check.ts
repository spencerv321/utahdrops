import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Search regression set on real DABS products (identities checked against
 * the catalog on 2026-09-24). Read-only; run locally with a loaded catalog, or
 * in production via report.yml mode "searchcheck".
 *
 *   npx tsx scripts/search-check.ts
 *
 * Also verifies that lib/search-key.ts matches the database's search_key for
 * every product name. Exits 1 on any failure.
 */
interface Case {
  q: string;
  /** This code must be the first result. */
  top?: string;
  /** These must all appear in the first `within` results (default 5). */
  includes?: string[];
  within?: number;
  /** These must not appear in the first 20 (unrelated bottles, or distinct variants the words rule out). */
  excludes?: string[];
}

export const CASES: Case[] = [
  // Blanton's: DABS lists the standard bottle as "BLANTON BOURBON SNGL BRRL".
  { q: "Blanton's", top: "016850", includes: ["016873", "016874", "921500"] },
  { q: "Blantons", top: "016850" },
  { q: "Blanton", top: "016850" },
  { q: "blanton single barrel", top: "016850" },
  // Maker's Mark: sizes and 46 stay distinct; "Hay Maker" / "Troublemaker" wines don't crowd in.
  { q: "Maker's Mark", top: "019476", includes: ["019478", "019477", "019475", "019486"], excludes: ["412200", "516720"] },
  { q: "makers mark", top: "019476", excludes: ["412200", "516720"] },
  { q: "maker's mark 46", top: "019486", excludes: ["019476"] },
  // E.H. Taylor: DABS writes both "E.H. TAYLOR" and "E H TAYLOR".
  { q: "E.H. Taylor", includes: ["025091", "027101", "021607"] },
  { q: "EH Taylor", includes: ["025091", "027101", "021607"], excludes: ["093964"] },
  { q: "e h taylor rye", includes: ["025091", "027101"], within: 2 },
  { q: "Buffalo Trace", top: "018006" },
  { q: "Eagle Rare", top: "017766", includes: ["017746"] },
  { q: "eagle rare 10 year", top: "017766", includes: ["017746"], within: 2 },
  { q: "Tito's", includes: ["038178", "038177", "038176", "038174", "038179"] },
  { q: "titos 750", top: "038176" },
  { q: "jack daniel's", top: "026828" },
  // Wine
  { q: "kim crawford sauvignon blanc", top: "407766", includes: ["407757"] },
  { q: "kim crawford sauv blanc", top: "407766", includes: ["407757"] },
  { q: "meiomi pinot noir", top: "443950" },
  { q: "josh cab", top: "478120" },
  { q: "taylor fladgate 20", top: "090884", excludes: ["090810"] },
  // Tequila
  { q: "casamigos reposado", top: "089177" },
  { q: "patron silver", top: "088296" },
  { q: "don julio anejo", top: "089175" },
  // Beer
  { q: "modelo negra", top: "989012" },
  { q: "lagunitas ipa", includes: ["919658", "917389"] },
];

export async function runSearchCheck(): Promise<boolean> {
  const { sql } = await import("../lib/db");
  const { searchProducts } = await import("../lib/queries");
  const { searchKey } = await import("../lib/search-key");

  const names = await sql<{ name: string; search_key: string | null }[]>`select name, search_key from products`;
  const mismatched = names.filter((r) => searchKey(r.name) !== r.search_key);
  let ok = mismatched.length === 0;
  console.log(`search_key parity: ${names.length - mismatched.length}/${names.length} names match`);
  for (const r of mismatched.slice(0, 5)) console.log(`  MISMATCH ${JSON.stringify(r)} vs ${JSON.stringify(searchKey(r.name))}`);

  for (const c of CASES) {
    const { rows, total } = await searchProducts({ q: c.q, page: 1 });
    const codes = rows.map((r) => r.csc);
    const within = codes.slice(0, c.within ?? 5);
    const problems: string[] = [];
    if (c.top && codes[0] !== c.top) problems.push(`top ${codes[0] ?? "none"}, want ${c.top}`);
    for (const i of c.includes ?? []) if (!within.includes(i)) problems.push(`${i} not in top ${within.length}`);
    for (const x of c.excludes ?? []) if (codes.slice(0, 20).includes(x)) problems.push(`${x} in top 20`);
    if (problems.length) ok = false;
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${JSON.stringify(c.q).padEnd(32)} ${String(total).padStart(4)} results · ` +
        rows.slice(0, 3).map((r) => `${r.csc} ${r.name}`).join(" | ") +
        (problems.length ? `\n     ${problems.join("; ")}` : "")
    );
  }
  return ok;
}

if (process.argv[1]?.endsWith("search-check.ts")) {
  runSearchCheck().then(
    (ok) => process.exit(ok ? 0 : 1),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
