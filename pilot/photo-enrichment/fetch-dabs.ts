/**
 * Photo/enrichment pilot: the DABS side of each sampled listing (name, size,
 * category, price, status, detail-page description, and every name the code
 * was sold under in monthly sales). Detail pages go through the shared
 * politeFetch pacing like every other DABS request.
 *
 *   npx tsx pilot/photo-enrichment/fetch-dabs.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
config({ path: ".env.local", quiet: true });

async function main() {
  const { sql } = await import("../../lib/db");
  const { fetchProductDetail } = await import("../../lib/dabs/detail");
  const sample = JSON.parse(readFileSync(join(__dirname, "data/sample.json"), "utf8")).products as { csc: string }[];
  const outPath = join(__dirname, "data/dabs.json");
  const out: Record<string, unknown> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  for (const { csc } of sample) {
    if (out[csc] && (out[csc] as { detail_error?: string }).detail_error === undefined) continue;
    const [p] = await sql`select csc, name, category, subcategory, size_ml, status, current_price::float8 as price, in_stock, delisted_at from products where csc = ${csc}`;
    const sales = await sql`select distinct item_name, class_name, size_ml from monthly_sales where item_code = ${csc}`;
    let description: string | null = null, detail_error: string | undefined;
    try {
      const d = await fetchProductDetail(csc);
      description = d.description;
    } catch (e) { detail_error = (e as Error).message; }
    out[csc] = { ...p, sale_names: sales.map((s) => s.item_name), sale_classes: [...new Set(sales.map((s) => s.class_name))], description, detail_error, fetched_at: new Date().toISOString() };
    writeFileSync(outPath, JSON.stringify(out, null, 1));
    process.stdout.write(`${csc} ${description ? "desc" : detail_error ? "ERR" : "-"}\n`);
  }
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
