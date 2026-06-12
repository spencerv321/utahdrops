import * as cheerio from "cheerio";
import { DABS_LOCATOR_URL } from "@/lib/config";
import { politeFetch, ScrapeShapeError, cleanName } from "./client";

export interface DetailStoreRow {
  storeId: number;
  storeName: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  qty: number;
  lat: number | null;
  lng: number | null;
}

export interface ProductDetail {
  sku: string;
  name: string;
  statusRaw: string | null;
  warehouseQty: number | null;
  onOrderQty: number | null;
  price: number | null;
  description: string | null;
  stores: DetailStoreRow[];
}

/**
 * The detail page is a two-step flow: GetDetailUrl?sku=X stashes the SKU in
 * an ASP.NET TempData cookie (single-use), and ProductDetail/Index consumes
 * it. The cookie from step 1 must ride along on step 2.
 */
export async function fetchProductDetail(sku: string): Promise<ProductDetail> {
  const prime = await politeFetch(
    `${DABS_LOCATOR_URL}/Products/GetDetailUrl?sku=${encodeURIComponent(sku)}`,
    { headers: { "X-Requested-With": "XMLHttpRequest", Referer: DABS_LOCATOR_URL } }
  );
  if (!prime.ok) throw new Error(`GetDetailUrl(${sku}) returned ${prime.status}`);
  const tempData = (prime.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const res = await politeFetch(
    `${DABS_LOCATOR_URL}/ProductDetail/Index`,
    { headers: { Referer: DABS_LOCATOR_URL } },
    tempData
  );
  if (!res.ok) throw new Error(`ProductDetail(${sku}) returned ${res.status}`);
  const html = await res.text();
  return parseDetailPage(sku, html);
}

export function parseDetailPage(sku: string, html: string): ProductDetail {
  const $ = cheerio.load(html);

  const table = $("#storeTable");
  if (table.length === 0) {
    throw new ScrapeShapeError(`detail page for ${sku} has no #storeTable`);
  }

  // Header block: name in the 200% span, then "<sku> | <status>",
  // then "<n> At Warehouse | <n> On Order", then "$<price> *"
  const name = cleanName($("span").filter((_, el) => ($(el).attr("style") ?? "").includes("200%")).first().text());

  let statusRaw: string | null = null;
  $("span").each((_, el) => {
    const text = $(el).text().trim();
    if (!statusRaw && /^[1ADLNPSTUX]\s{1,}\w/.test(text) && text.length < 60) {
      statusRaw = text;
    }
  });

  const bodyText = $("body").text();
  const warehouse = bodyText.match(/([\d,]+)\s*At Warehouse/i);
  const onOrder = bodyText.match(/([\d,]+)\s*On Order/i);
  const price = bodyText.match(/\$\s*([\d,]+\.\d{2})\s*\*/);
  const description = $("p[style*='solid']").first().text().trim() || null;

  const stores: DetailStoreRow[] = [];
  table.find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 6) return;
    const storeNum = parseInt($(tds[0]).text().trim(), 10);
    if (Number.isNaN(storeNum)) return;
    const pin = $(tds[6]).find("a").attr("href") ?? "";
    const coords = pin.match(/q=(-?[\d.]+),(-?[\d.]+)/);
    stores.push({
      storeId: storeNum,
      storeName: cleanName($(tds[1]).text()),
      address: cleanName($(tds[2]).text()) || null,
      city: cleanName($(tds[3]).text()) || null,
      phone: cleanName($(tds[4]).text()) || null,
      qty: parseInt($(tds[5]).text().trim(), 10) || 0,
      lat: coords ? parseFloat(coords[1]) : null,
      lng: coords ? parseFloat(coords[2]) : null,
    });
  });

  return {
    sku,
    name,
    statusRaw,
    warehouseQty: warehouse ? parseInt(warehouse[1].replace(/,/g, ""), 10) : null,
    onOrderQty: onOrder ? parseInt(onOrder[1].replace(/,/g, ""), 10) : null,
    price: price ? parseFloat(price[1].replace(/,/g, "")) : null,
    description,
    stores,
  };
}
