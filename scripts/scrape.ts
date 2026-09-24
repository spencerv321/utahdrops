import { config } from "dotenv";
config({ path: ".env.local" });

const JOBS: Record<string, () => Promise<unknown>> = {
  catalog: () => import("../lib/jobs/catalog").then((m) => m.runCatalogJob()),
  "store-inventory": () =>
    import("../lib/jobs/store-inventory").then((m) => m.runStoreInventoryJob()),
  allocated: () => import("../lib/jobs/allocated").then((m) => m.runAllocatedJob()),
  xlsx: () => import("../lib/jobs/xlsx").then((m) => m.runXlsxJob()),
  percentiles: () => import("../lib/jobs/percentiles").then((m) => m.runPercentilesJob()),
  digest: () => import("../lib/jobs/digest").then((m) => m.runDigestJob()),
  sales: () =>
    import("../lib/jobs/sales").then((m) => m.runSalesJob({ refresh: process.env.SALES_REFRESH === "1" })),
};

async function main() {
  const job = process.argv[2];
  if (!job || !JOBS[job]) {
    console.error(`Usage: tsx scripts/scrape.ts <${Object.keys(JOBS).join("|")}>`);
    process.exit(1);
  }
  console.log(`[${new Date().toISOString()}] running ${job}…`);
  const result = await JOBS[job]();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
