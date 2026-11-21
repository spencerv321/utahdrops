import * as cheerio from "cheerio";
import { DABS_RHDP_URL } from "@/lib/config";
import { politeFetch, ScrapeShapeError, cleanName } from "./client";
import { parseCloseDate } from "@/lib/drawing-alerts";

/**
 * DABS Rare High Demand Product (RHDP) drawing page: future, current and past
 * drawings, each listing products as
 *   "GEORGE T STAGG BOURBON - 018416 - $154.99 - 52 Bottles - 7102 Entries".
 * The page also lists winners' names under each product; those are never
 * read into our data.
 */
export interface RhdpItem {
  section: "future" | "current" | "past";
  drawing: string;
  itemCode: string;
  productName: string;
  price: number | null;
  bottles: number | null;
  entries: number | null;
}

const ITEM = /^(.*?)\s+-\s+(\d{6})\s+-\s+\$([\d,.]+)(?:\s+-\s+([\d,]+)\s+Bottles?)?(?:\s+-\s+([\d,]+)\s+Entr(?:y|ies))?/i;

/** Open or upcoming drawing, with whatever date text DABS shows beside it. */
export interface RhdpWindow {
  section: "future" | "current";
  drawing: string;
  /** Text around the drawing other than its product lines (dates, notes), or null. */
  datesText: string | null;
  closesAt: Date | null;
}

export async function fetchRhdpPageHtml(): Promise<string> {
  const res = await politeFetch(DABS_RHDP_URL);
  if (!res.ok) throw new Error(`RHDP page returned ${res.status}`);
  return res.text();
}

export async function fetchRhdpDrawings(): Promise<RhdpItem[]> {
  return parseRhdpPage(await fetchRhdpPageHtml());
}

/**
 * Drawings under "future" and "current", with the text DABS shows around
 * each one minus its product lines, and a close date when that text gives
 * one. Past drawings (which list winners) are never read here.
 */
export function parseRhdpWindows(html: string): RhdpWindow[] {
  const $ = cheerio.load(html);
  const out: RhdpWindow[] = [];
  for (const section of ["future", "current"] as const) {
    const root = $(`#${section}`);
    root.find("a.btn-link[href^='#']").each((_, a) => {
      const drawing = cleanName($(a).text());
      const panel = root.find($(a).attr("href")!);
      if (!drawing || !panel.length) return;
      const body = panel.clone();
      body.find("button.NormalGridView, .NormalGridView").remove();
      // The header row beside the link, when it's its own element (not the section or the panel's parent).
      const parent = $(a).parent();
      let headerText = "";
      if (!parent.is(root) && !parent.find($(a).attr("href")!).length && !parent.find(".NormalGridView").length) {
        const header = parent.clone();
        header.find("a.btn-link").remove();
        headerText = header.text();
      }
      const text = cleanName(`${headerText} ${body.text()}`).slice(0, 500);
      out.push({ section, drawing, datesText: text || null, closesAt: parseCloseDate(text) });
    });
  }
  return out;
}

export function parseRhdpPage(html: string): RhdpItem[] {
  const $ = cheerio.load(html);
  const out: RhdpItem[] = [];
  const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : null);
  for (const section of ["future", "current", "past"] as const) {
    const root = $(`#${section}`);
    if (!root.length) throw new ScrapeShapeError(`RHDP page has no #${section} section`);
    // Each drawing: a header link naming it, then a collapse panel of products.
    root.find("a.btn-link[href^='#']").each((_, a) => {
      const drawing = cleanName($(a).text());
      const panel = root.find($(a).attr("href")!);
      if (!drawing || !panel.length) return;
      panel.find("button.NormalGridView, .NormalGridView").each((_, b) => {
        const m = cleanName($(b).text()).match(ITEM);
        if (!m) return;
        out.push({
          section,
          drawing,
          itemCode: m[2],
          productName: cleanName(m[1]),
          price: num(m[3]),
          bottles: num(m[4]),
          entries: num(m[5]),
        });
      });
    });
  }
  // A page with drawing headers but no parseable products means the markup changed.
  if (out.length === 0 && $("#past a.btn-link[href^='#']").length > 0) {
    throw new ScrapeShapeError("RHDP past drawings present but no product lines parsed");
  }
  return out;
}
