/**
 * Utah makers (/makers): each maker's matched catalog products, for spotting
 * false or missing matches after editing data/makers.json or after the
 * monthly xlsx job refreshes products.vendor_code. Read-only.
 * Local: npx tsx scripts/makers-check.ts [slug]. Production: report.yml → makers.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

export async function makersReport(sql: typeof import("../lib/db").sql, only?: string) {
  const { MAKERS } = await import("../lib/makers");
  const { getMakerProducts } = await import("../lib/maker-products");
  const [cov] = (await sql`
    select count(*)::int as products, count(vendor_code)::int as with_vendor,
           count(*) filter (where in_stock)::int as in_stock,
           count(vendor_code) filter (where in_stock)::int as in_stock_with_vendor
    from products`) as unknown as Record<string, number>[];
  console.log(`\n## vendor coverage (xlsx job fills vendor_code)\n${JSON.stringify(cov)}`);
  for (const m of MAKERS) {
    if (only && m.slug !== only) continue;
    const { listed, other } = await getMakerProducts(m);
    console.log(`\n== ${m.slug}: ${listed.length} listed (${listed.filter((p) => p.in_stock).length} in stock), ${other.length} other`);
    for (const p of [...listed, ...other].slice(0, only ? 400 : 12)) {
      console.log(`  ${p.csc} ${p.in_stock ? "*" : " "} ${p.name} | ${p.category} | ${p.status}`);
    }
  }
  await sql.end();
}

if (process.argv[1]?.endsWith("makers-check.ts")) {
  import("../lib/db").then(({ sql }) => makersReport(sql, process.argv[2])).then(() => process.exit(0));
}
