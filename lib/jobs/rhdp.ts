import { sql } from "@/lib/db";
import { fetchRhdpPageHtml, parseRhdpPage, parseRhdpWindows } from "@/lib/dabs/rhdp";
import { withRun } from "./run";

/**
 * Records DABS RHDP drawings (products, bottles offered, entries). DABS only
 * keeps recent drawings on the page, so this builds our own history. Then
 * sends drawing alerts (a separate run, so an email problem never fails this
 * job or loses the data).
 */
export async function runRhdpJob() {
  const result = await withRun("rhdp", async () => {
    const html = await fetchRhdpPageHtml();
    const items = parseRhdpPage(html);
    const windows = parseRhdpWindows(html);
    if (items.length) {
      await sql`
        insert into rhdp_drawings ${sql(
          items.map((i) => ({
            drawing: i.drawing,
            item_code: i.itemCode,
            product_name: i.productName,
            price: i.price,
            bottles: i.bottles,
            entries: i.entries,
            section: i.section,
          })),
          "drawing", "item_code", "product_name", "price", "bottles", "entries", "section"
        )}
        on conflict (drawing, item_code) do update set
          product_name = excluded.product_name,
          price = excluded.price,
          bottles = coalesce(excluded.bottles, rhdp_drawings.bottles),
          entries = coalesce(excluded.entries, rhdp_drawings.entries),
          section = excluded.section,
          last_seen = now()`;
    }
    for (const w of windows) {
      await sql`
        insert into rhdp_drawing_windows (drawing, announced_at, opened_at, closes_at, dates_text)
        values (
          ${w.drawing},
          ${w.section === "future" ? sql`now()` : null},
          ${w.section === "current" ? sql`now()` : null},
          ${w.closesAt},
          ${w.datesText}
        )
        on conflict (drawing) do update set
          announced_at = coalesce(rhdp_drawing_windows.announced_at, excluded.announced_at),
          opened_at = coalesce(rhdp_drawing_windows.opened_at, excluded.opened_at),
          closes_at = coalesce(excluded.closes_at, rhdp_drawing_windows.closes_at),
          dates_text = coalesce(excluded.dates_text, rhdp_drawing_windows.dates_text),
          updated_at = now()`;
    }
    const bySection: Record<string, number> = {};
    for (const i of items) bySection[i.section] = (bySection[i.section] ?? 0) + 1;
    return {
      items: items.length,
      drawings: new Set(items.map((i) => i.drawing)).size,
      ...bySection,
      open_or_upcoming: windows.length,
      with_close_date: windows.filter((w) => w.closesAt).length,
    };
  });

  try {
    const { runDrawingAlertsJob } = await import("./drawing-alerts");
    const alerts = await runDrawingAlertsJob();
    return { ...result, alerts: alerts.detail };
  } catch (err) {
    // Recorded in scrape_runs as a failed drawing_alerts run (report.yml shows it); the data above is kept.
    return { ...result, alerts: { error: err instanceof Error ? err.message : String(err) } };
  }
}
