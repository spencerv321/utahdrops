import * as cheerio from "cheerio";
import * as XLSX from "xlsx";
import { DABS_PRODUCT_LIST_PAGE } from "@/lib/config";
import { politeFetch, ScrapeShapeError, cleanName, parseSizeMl } from "./client";

export interface XlsxProduct {
  csc: string;
  name: string;
  sizeMl: number | null;
  status: string | null;
  category: string | null;
  subcategory: string | null;
  isSpa: boolean;
  price: number | null;
  /** DABS vendor as listed ("EPIC BREWING COMPANY, LLC (001788)"). */
  vendor: string | null;
  /** See vendorCode(). */
  vendorCode: string | null;
}

/**
 * The "Vendor Cd" column as a stable key: digits only, no leading zeros, so
 * "001788" and "VC0000200479" become "1788" and "200479". Falls back to a
 * code in the vendor name's parentheses ("... (001788)").
 */
export function vendorCode(code: unknown, name?: unknown): string | null {
  const fromCode = String(code ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (fromCode) return fromCode;
  const m = String(name ?? "").match(/\((\d+)\)\s*$/);
  return m ? m[1].replace(/^0+/, "") || null : null;
}

/** Discover the current monthly product-list XLSX link rather than guessing the URL. */
export async function findProductListUrl(): Promise<string> {
  const res = await politeFetch(DABS_PRODUCT_LIST_PAGE);
  if (!res.ok) throw new Error(`Product list page returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const links: string[] = [];
  $("a[href$='.xlsx']").each((_, a) => {
    const href = $(a).attr("href");
    if (href?.toLowerCase().includes("product-list")) links.push(href);
  });
  if (links.length === 0) {
    throw new ScrapeShapeError("no Product-List .xlsx link on interactive-product-list page");
  }
  return new URL(links[0], DABS_PRODUCT_LIST_PAGE).href;
}

export async function fetchProductListXlsx(url?: string): Promise<XlsxProduct[]> {
  const target = url ?? (await findProductListUrl());
  const res = await politeFetch(target);
  if (!res.ok) throw new Error(`XLSX download returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return parseProductListXlsx(buf);
}

/**
 * Header names drift between fiscal years, so match loosely. We only trust the
 * XLSX for catalog facts the locator API doesn't expose (codes, SPA flag);
 * price/quantities stay owned by the catalog scrape.
 */
export function parseProductListXlsx(buf: Buffer): XlsxProduct[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  // Find the header row: contains something CSC-ish and something name-ish.
  const headerRowIdx = grid.findIndex((row) => {
    const cells = row.map((c) => String(c ?? "").toUpperCase());
    return (
      cells.some((c) => /CSC|ITEM\s*CODE|^CODE$|SKU/.test(c)) &&
      cells.some((c) => /DESC|NAME/.test(c))
    );
  });
  if (headerRowIdx === -1) {
    throw new ScrapeShapeError("product-list XLSX: no header row with item code + description");
  }

  const headers = grid[headerRowIdx].map((c) => String(c ?? "").toUpperCase().trim());
  const idx = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const cscIdx = idx(/CSC|ITEM\s*CODE|^CODE$|SKU/);
  const nameIdx = idx(/DESC|NAME/);
  const sizeIdx = idx(/SIZE/);
  const statusIdx = idx(/STATUS/);
  const divIdx = idx(/DIV/);
  const deptIdx = idx(/DEPT|CATEGORY/);
  const classIdx = idx(/CLASS|SUB/);
  const spaIdx = idx(/SPA/);
  const priceIdx = idx(/PRICE|RETAIL/);
  const vendorIdx = idx(/^VENDOR\s*(NAME)?$/);
  const vendorCdIdx = idx(/^VENDOR\s*(CD|CODE|NO|#)/);

  const out: XlsxProduct[] = [];
  for (const row of grid.slice(headerRowIdx + 1)) {
    const rawCsc = row[cscIdx];
    const name = cleanName(String(row[nameIdx] ?? ""));
    if (rawCsc == null || !name) continue;
    const csc = String(rawCsc).trim().padStart(6, "0");
    if (!/^\d{6}$/.test(csc)) continue;
    const sizeRaw = sizeIdx >= 0 ? row[sizeIdx] : null;
    const sizeMl =
      typeof sizeRaw === "number"
        ? Math.round(sizeRaw)
        : sizeRaw
          ? parseSizeMl(String(sizeRaw)) ?? (parseInt(String(sizeRaw), 10) || null)
          : parseSizeMl(name);
    const price = priceIdx >= 0 ? parseFloat(String(row[priceIdx] ?? "")) : NaN;
    out.push({
      csc,
      name,
      sizeMl,
      status: statusIdx >= 0 ? String(row[statusIdx] ?? "").trim().charAt(0) || null : null,
      category: deptIdx >= 0 ? cleanName(String(row[deptIdx] ?? "")) || null
        : divIdx >= 0 ? cleanName(String(row[divIdx] ?? "")) || null : null,
      subcategory: classIdx >= 0 ? cleanName(String(row[classIdx] ?? "")) || null : null,
      isSpa: spaIdx >= 0 ? /Y|TRUE|X|1/.test(String(row[spaIdx] ?? "").toUpperCase()) : false,
      price: Number.isFinite(price) ? price : null,
      vendor: vendorIdx >= 0 ? cleanName(String(row[vendorIdx] ?? "")) || null : null,
      vendorCode: vendorCode(vendorCdIdx >= 0 ? row[vendorCdIdx] : null, vendorIdx >= 0 ? row[vendorIdx] : null),
    });
  }
  if (out.length < 1000) {
    throw new ScrapeShapeError(`product-list XLSX parsed only ${out.length} rows — header mapping likely wrong`);
  }
  return out;
}
