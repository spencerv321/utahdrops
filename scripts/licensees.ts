/**
 * Pull the DABS Licensee List and store it (licensees table, powers /bars).
 *
 *   npx tsx scripts/licensees.ts                 # fetch with a headless browser
 *   npx tsx scripts/licensees.ts --csv FILE      # load a saved CSV instead
 *   npx tsx scripts/licensees.ts --save FILE     # fetch, also write a CSV, don't touch the DB
 *
 * The report is a public Looker Studio page that only fills in inside a
 * browser, so this opens it in Chromium like any viewer and reads the table
 * from the page's own data response (see lib/licensees.ts). Playwright isn't
 * an app dependency: set PLAYWRIGHT_DIR to a folder where `playwright` is
 * installed (licensees.yml does this). Behind a proxy (the Claude sandbox),
 * HTTPS_PROXY is passed to Chromium; CHROMIUM_PATH picks a browser binary.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { LICENSEE_COLUMNS, LICENSEE_REPORT_URL, MIN_LICENSEES, parseLookerTable, toLicensee } from "../lib/licensees";

// The few Playwright calls used here (it isn't installed in the repo).
interface PwResponse { url(): string; text(): Promise<string> }
interface PwPage {
  on(event: "response", fn: (res: PwResponse) => void): void;
  goto(url: string, opts: object): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
}
interface PwBrowser { newPage(opts: object): Promise<PwPage>; close(): Promise<void> }
interface Playwright { chromium: { launch(opts: object): Promise<PwBrowser> } }

async function fetchRows(): Promise<string[][]> {
  const dir = resolve(process.env.PLAYWRIGHT_DIR ?? ".");
  const { chromium } = createRequire(join(dir, "noop.js"))("playwright") as Playwright;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    let table: string[][] | null = null;
    const pending: Promise<void>[] = [];
    page.on("response", (res) => {
      if (!/batchedDataV2/.test(res.url())) return;
      pending.push(
        res.text().then(
          (body) => {
            const rows = parseLookerTable(body);
            if (rows && rows.length > (table?.length ?? 0)) table = rows;
          },
          () => {}
        )
      );
    });
    await page.goto(LICENSEE_REPORT_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    for (let waited = 0; waited < 90_000 && !table; waited += 2_000) {
      await page.waitForTimeout(2_000);
      await Promise.all(pending);
    }
    if (!table) throw new Error("licensees: the report's table data never arrived");
    return table;
  } finally {
    await browser.close();
  }
}

function readCsv(file: string): string[][] {
  const out: string[][] = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    out.push(cells);
  }
  return out;
}

function writeCsv(file: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync(file, [LICENSEE_COLUMNS.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n");
}

async function main() {
  const args = process.argv.slice(2);
  const csvIn = args.includes("--csv") ? args[args.indexOf("--csv") + 1] : null;
  const csvOut = args.includes("--save") ? args[args.indexOf("--save") + 1] : null;
  const cells = csvIn ? readCsv(csvIn) : await fetchRows();
  console.log(`licensees: ${cells.length} rows from ${csvIn ?? "the report"}`);
  if (cells.length < MIN_LICENSEES) throw new Error(`licensees: only ${cells.length} rows; refusing`);
  if (csvOut) {
    writeCsv(csvOut, cells);
    console.log(`wrote ${csvOut}`);
    return;
  }
  const { runLicenseesJob } = await import("../lib/jobs/licensees");
  const result = await runLicenseesJob(cells.map(toLicensee));
  console.log(JSON.stringify(result));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
