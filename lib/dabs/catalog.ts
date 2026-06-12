import { z } from "zod";
import { DABS_LOCATOR_URL } from "@/lib/config";
import { politeFetch, ScrapeShapeError } from "./client";

const SEARCH_URL = `${DABS_LOCATOR_URL}/Products/LoadProductTable`;

/** Column order must mirror the DataTables init on the locator page. */
const COLUMNS = [
  { data: "name", orderable: true },
  { data: "sku", orderable: false },
  { data: "displayGroup", orderable: true },
  { data: "status", orderable: true },
  { data: "warehouseQty", orderable: true },
  { data: "storeQty", orderable: true },
  { data: "onOrderQty", orderable: true },
  { data: "currentPrice", orderable: true },
] as const;

const CatalogRow = z.object({
  name: z.string(),
  sku: z.string(),
  displayGroup: z.string().nullish(),
  status: z.string().nullish(),
  warehouseQty: z.number().nullish(),
  storeQty: z.number().nullish(),
  onOrderQty: z.number().nullish(),
  currentPrice: z.number().nullish(),
  onSpa: z.boolean().nullish(),
  newItem: z.boolean().nullish(),
  inStock: z.boolean().nullish(),
});
export type CatalogRow = z.infer<typeof CatalogRow>;

const CatalogResponse = z.object({
  recordsTotal: z.number(),
  recordsFiltered: z.number(),
  data: z.array(CatalogRow),
});

function buildBody(start: number, length: number): URLSearchParams {
  const body = new URLSearchParams();
  body.set("draw", "1");
  body.set("start", String(start));
  body.set("length", String(length));
  body.set("search[value]", "");
  body.set("search[regex]", "false");
  body.set("order[0][column]", "1"); // sku — stable order so pagination doesn't skip rows
  body.set("order[0][dir]", "asc");
  COLUMNS.forEach((col, i) => {
    body.set(`columns[${i}][data]`, col.data);
    body.set(`columns[${i}][name]`, "");
    body.set(`columns[${i}][searchable]`, "true");
    body.set(`columns[${i}][orderable]`, String(col.orderable));
    body.set(`columns[${i}][search][value]`, "");
    body.set(`columns[${i}][search][regex]`, "false");
  });
  // empty filters = full catalog
  for (const f of ["item_code", "item_name", "category", "sub_category", "price_min", "price_max", "status"]) {
    body.set(f, "");
  }
  body.set("on_spa", "false");
  body.set("new_items", "false");
  body.set("in_stock", "false");
  return body;
}

async function fetchPage(start: number, length: number) {
  const res = await politeFetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: DABS_LOCATOR_URL,
    },
    body: buildBody(start, length).toString(),
  });
  if (!res.ok) throw new Error(`LoadProductTable returned ${res.status}`);
  const json = await res.json().catch(() => {
    throw new ScrapeShapeError("LoadProductTable did not return JSON");
  });
  const parsed = CatalogResponse.safeParse(json);
  if (!parsed.success) {
    throw new ScrapeShapeError(`LoadProductTable schema mismatch: ${parsed.error.message.slice(0, 500)}`);
  }
  return parsed.data;
}

/**
 * Pull the entire catalog. Tries a large page size first (server-side
 * DataTables usually honors it), falling back to 50 if the server clamps.
 */
export async function fetchFullCatalog(
  onProgress?: (fetched: number, total: number) => void
): Promise<CatalogRow[]> {
  const first = await fetchPage(0, 1000);
  const pageSize = first.data.length > 50 ? 1000 : 50;
  const total = first.recordsFiltered;
  const bySku = new Map<string, CatalogRow>();
  for (const row of first.data) bySku.set(row.sku, row);

  let start = first.data.length;
  while (start < total) {
    const page = await fetchPage(start, pageSize);
    if (page.data.length === 0) break; // server says done despite count — trust the data
    for (const row of page.data) bySku.set(row.sku, row);
    start += page.data.length;
    onProgress?.(bySku.size, total);
  }

  // Loud abort if coverage collapsed (shape change, silent truncation, etc.)
  if (bySku.size < total * 0.95) {
    throw new ScrapeShapeError(
      `catalog fetch returned ${bySku.size} of ${total} expected rows`
    );
  }
  return [...bySku.values()];
}
