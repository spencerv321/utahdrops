import * as cheerio from "cheerio";
import * as XLSX from "xlsx";
import { DABS_SALES_ANALYSIS_PAGE } from "@/lib/config";
import { politeFetch, ScrapeShapeError, cleanName } from "./client";

/**
 * DABS monthly Sales Analysis reports (one .xlsx per month, linked from the
 * vendors/sales-analysis page). Each row is one item line: bottles and dollars
 * sold statewide that month.
 *
 * Layout quirks seen across May 2025 – Aug 2026 (all handled below):
 * - the title block moved (header on row 4 vs 5; totals on different rows)
 * - the month is "Aug 2026" in most files but an Excel date serial in some
 * - May 2025 stores item codes as numbers (leading zeros lost)
 * - one item code can appear on several lines (vintages, renames)
 */

export interface SalesReportLink {
  url: string;
  label: string;
  /** "YYYY-MM" from the link text, e.g. "August 2026 Sales Analysis Report". */
  labelMonth: string | null;
  /** "YYYY-MM" from the file name's FYxx_Pyy. */
  fileMonth: string | null;
}

export interface SalesLine {
  line: number;
  itemCode: string;
  itemName: string | null;
  classCode: string | null;
  className: string | null;
  sizeMl: number | null;
  bottles: number | null;
  dollars: number | null;
  status: string | null;
  raw: Record<string, unknown>;
}

export interface ParsedSalesReport {
  /** "YYYY-MM" from the month cell in the file's title block. */
  titleMonth: string;
  /** "FY27 P2" from the title block. */
  fiscalLabel: string;
  /** "YYYY-MM" the fiscal label stands for. */
  fiscalMonth: string;
  reportedDollars: number | null;
  lines: SalesLine[];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function ym(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Utah's fiscal year starts in July: FY27 P1 = Jul 2026, FY27 P12 = Jun 2027. */
export function fiscalToMonth(fy: number, period: number): string | null {
  if (!(period >= 1 && period <= 12)) return null;
  const month = ((period + 5) % 12) + 1;
  const year = 2000 + fy - (period <= 6 ? 1 : 0);
  return ym(year, month);
}

/** "August 2026", "Aug 2026", "Sept 2025" → "YYYY-MM". */
export function textToMonth(text: string): string | null {
  const m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  return idx === -1 ? null : ym(Number(m[2]), idx + 1);
}

export function fileNameToMonth(url: string): string | null {
  const m = url.match(/FY(\d{2})_P(\d{1,2})/i);
  return m ? fiscalToMonth(Number(m[1]), Number(m[2])) : null;
}

/** Discover the monthly report links rather than guessing file names. */
export async function findSalesReportLinks(): Promise<SalesReportLink[]> {
  const res = await politeFetch(DABS_SALES_ANALYSIS_PAGE);
  if (!res.ok) throw new Error(`Sales analysis page returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const links: SalesReportLink[] = [];
  const seen = new Set<string>();
  $("a[href$='.xlsx']").each((_, a) => {
    const href = $(a).attr("href");
    if (!href || !/sales-analysis/i.test(href)) return;
    const url = new URL(href, DABS_SALES_ANALYSIS_PAGE).href;
    if (seen.has(url)) return;
    seen.add(url);
    const label = cleanName($(a).text());
    links.push({ url, label, labelMonth: textToMonth(label), fileMonth: fileNameToMonth(url) });
  });
  if (links.length === 0) {
    throw new ScrapeShapeError("no Sales-Analysis .xlsx links on the sales-analysis page");
  }
  return links;
}

export async function downloadSalesReport(url: string): Promise<Buffer> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`Sales report download returned ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const REQUIRED = ["class code", "class name", "bottle size", "item code", "item name", "bottle count sales", "status"];

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function text(v: unknown): string | null {
  if (v == null) return null;
  const s = cleanName(String(v));
  return s || null;
}

export function parseSalesReport(buf: Buffer): ParsedSalesReport {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const headerIdx = grid.findIndex((row) =>
    row.some((c) => String(c ?? "").trim().toLowerCase() === "item code")
  );
  if (headerIdx === -1) throw new ScrapeShapeError("sales report: no header row with Item Code");
  const headers = grid[headerIdx].map((c) => (c == null ? "" : String(c).trim()));
  const lower = headers.map((h) => h.toLowerCase());
  const col = Object.fromEntries(REQUIRED.map((k) => [k, lower.indexOf(k)]));
  const missing = REQUIRED.filter((k) => col[k] === -1);
  if (missing.length) throw new ScrapeShapeError(`sales report: missing columns ${missing.join(", ")}`);
  // Two columns are called "Total": dollars (after Item Name) and 9L cases
  // (after Bottle Count Sales). Dollars is the first one after the name.
  const dollarsIdx = lower.findIndex((h, i) => h === "total" && i > col["item name"]);
  if (dollarsIdx === -1 || dollarsIdx > col["bottle count sales"]) {
    throw new ScrapeShapeError("sales report: no dollars Total column between Item Name and Bottle Count Sales");
  }

  // Title block: "FY27 P2", the month ("Aug 2026" or an Excel date serial),
  // and DABS's own gross-sales total (the first number over $1M).
  let fiscal: { fy: number; p: number } | null = null;
  let titleMonth: string | null = null;
  let reportedDollars: number | null = null;
  for (const row of grid.slice(0, headerIdx)) {
    for (const c of row) {
      if (c == null) continue;
      const s = String(c).trim();
      const f = s.match(/^FY(\d{2})\s*P(\d{1,2})$/i);
      if (f && !fiscal) fiscal = { fy: Number(f[1]), p: Number(f[2]) };
      else if (typeof c === "number" && Number.isInteger(c) && c > 40000 && c < 60000 && !titleMonth) {
        const d = XLSX.SSF.parse_date_code(c);
        if (d) titleMonth = ym(d.y, d.m);
      } else if (typeof c === "number" && c > 1_000_000 && reportedDollars == null) reportedDollars = c;
      else if (typeof c === "string" && !titleMonth && /^[A-Za-z]{3,9}\.?\s+\d{4}$/.test(s)) {
        titleMonth = textToMonth(s);
      }
    }
  }
  if (!fiscal) throw new ScrapeShapeError("sales report: no FYxx Pyy label in the title block");
  if (!titleMonth) throw new ScrapeShapeError("sales report: no month in the title block");
  const fiscalMonth = fiscalToMonth(fiscal.fy, fiscal.p);
  if (!fiscalMonth) throw new ScrapeShapeError(`sales report: bad fiscal period FY${fiscal.fy} P${fiscal.p}`);

  // Raw rows keep every column; repeated header names get a suffix.
  const rawKeys: string[] = [];
  const counts = new Map<string, number>();
  for (const h of headers) {
    if (!h) {
      rawKeys.push("");
      continue;
    }
    const n = (counts.get(h) ?? 0) + 1;
    counts.set(h, n);
    rawKeys.push(n === 1 ? h : `${h} (${n})`);
  }

  const lines: SalesLine[] = [];
  grid.slice(headerIdx + 1).forEach((row, i) => {
    const rawCode = row[col["item code"]];
    if (rawCode == null || String(rawCode).trim() === "") return;
    const itemCode = String(rawCode).trim().padStart(6, "0");
    if (!/^\d{6}$/.test(itemCode)) {
      throw new ScrapeShapeError(`sales report: unexpected item code "${rawCode}" on row ${headerIdx + i + 2}`);
    }
    const raw: Record<string, unknown> = {};
    rawKeys.forEach((k, j) => {
      if (k && row[j] != null) raw[k] = row[j];
    });
    const bottles = num(row[col["bottle count sales"]]);
    const size = num(row[col["bottle size"]]);
    lines.push({
      line: headerIdx + i + 2, // 1-based sheet row
      itemCode,
      itemName: text(row[col["item name"]]),
      classCode: text(row[col["class code"]]),
      className: text(row[col["class name"]]),
      sizeMl: size != null ? Math.round(size) : null,
      bottles: bottles != null ? Math.round(bottles) : null,
      dollars: num(row[dollarsIdx]),
      status: text(row[col["status"]]),
      raw,
    });
  });
  if (lines.length < 1000) {
    throw new ScrapeShapeError(`sales report parsed only ${lines.length} lines — layout likely changed`);
  }

  return {
    titleMonth,
    fiscalLabel: `FY${fiscal.fy} P${fiscal.p}`,
    fiscalMonth,
    reportedDollars,
    lines,
  };
}
