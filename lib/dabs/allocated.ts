import * as cheerio from "cheerio";
import { DABS_ALLOCATED_URL } from "@/lib/config";
import { politeFetch, ScrapeShapeError, cleanName } from "./client";

export interface AllocatedRow {
  productName: string;
  bottleQty: number | null;
  price: number | null;
  storeText: string | null;
  county: string | null;
}

/** Third Saturday of the month containing `d`. */
export function thirdSaturday(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const firstSaturdayOffset = (6 - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + firstSaturdayOffset + 14));
}

/** The next drop day (today counts until the day after), UTC midnight. */
export function nextDropDate(now = new Date()): Date {
  const next = thirdSaturday(now.getUTCFullYear(), now.getUTCMonth());
  if (now.getTime() > next.getTime() + 86400_000) {
    return thirdSaturday(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }
  return next;
}

/**
 * The list posts ~a week before the drop. Attribute scraped rows to the
 * upcoming third Saturday — or this month's if it was within the last week
 * (the list lingers a few days after the drop).
 */
export function currentDropDate(now = new Date()): Date {
  const thisMonth = thirdSaturday(now.getUTCFullYear(), now.getUTCMonth());
  const aWeekAfter = new Date(thisMonth.getTime() + 7 * 86400_000);
  if (now <= aWeekAfter) return thisMonth;
  return thirdSaturday(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

export async function fetchAllocatedList(): Promise<AllocatedRow[]> {
  const res = await politeFetch(DABS_ALLOCATED_URL);
  if (!res.ok) throw new Error(`Allocated page returned ${res.status}`);
  const html = await res.text();
  return parseAllocatedPage(html);
}

export function parseAllocatedPage(html: string): AllocatedRow[] {
  const $ = cheerio.load(html);

  // Find the table whose header row mentions ITEM NAME (Ninja Tables markup
  // changes class names between plugin versions; the header text is stable).
  let target: ReturnType<typeof $> | null = null;
  $("table").each((_, t) => {
    const headerText = $(t).find("thead, tr").first().text().toUpperCase();
    if (!target && headerText.includes("ITEM") && headerText.includes("QUANTITY")) {
      target = $(t);
    }
  });
  if (!target) {
    // An empty page between drops is normal — but no table at all when the
    // page structure exists is a shape change. Distinguish by page text.
    if ($("body").text().toUpperCase().includes("ALLOCATED")) return [];
    throw new ScrapeShapeError("allocated page has no recognizable product table");
  }

  const headers: string[] = [];
  (target as ReturnType<typeof $>)
    .find("thead th, tr:first-child th")
    .each((_, th) => {
      headers.push($(th).text().trim().toUpperCase());
    });
  const col = (label: string) => headers.findIndex((h) => h.includes(label));
  const nameIdx = col("ITEM");
  const qtyIdx = col("QUANTITY");
  const priceIdx = col("PRICE");
  const storeIdx = col("STORE");
  const countyIdx = col("COUNTY");
  if (nameIdx === -1) {
    throw new ScrapeShapeError(`allocated table headers changed: ${headers.join(" | ")}`);
  }

  const rows: AllocatedRow[] = [];
  (target as ReturnType<typeof $>).find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const text = (i: number) => (i >= 0 && tds[i] ? cleanName($(tds[i]).text()) : "");
    const productName = text(nameIdx);
    if (!productName) return;
    const price = text(priceIdx).match(/([\d,]+\.?\d*)/);
    rows.push({
      productName,
      bottleQty: parseInt(text(qtyIdx).replace(/,/g, ""), 10) || null,
      price: price ? parseFloat(price[1].replace(/,/g, "")) : null,
      storeText: text(storeIdx) || null,
      county: text(countyIdx) || null,
    });
  });
  return rows;
}
