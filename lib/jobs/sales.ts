import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import {
  downloadSalesReport,
  findSalesReportLinks,
  parseSalesReport,
  type SalesReportLink,
} from "@/lib/dabs/sales";
import { withRun } from "./run";

/** Months that are always re-downloaded, in case DABS revises a fresh report. */
const ALWAYS_RECHECK = 2;

/** Allowed gap between our line total and DABS's reported total, in dollars. */
const RECONCILE_TOLERANCE = 1;

/**
 * Imports DABS monthly Sales Analysis reports into sales_reports /
 * monthly_sales. Safe to re-run: a month is replaced only when its file
 * changed (sha256), inside one transaction. A month is imported only when the
 * link text, file name, fiscal label and title month all name the same month
 * and the lines add up to DABS's own total. Anything else is reported and
 * fails the run after the good months are in.
 */
export async function runSalesJob({ refresh = false }: { refresh?: boolean } = {}) {
  return withRun("sales", async () => {
    const links = await findSalesReportLinks();
    const existing = new Map(
      (
        await sql<{ month: string; file_sha256: string }[]>`
          select to_char(period_month, 'YYYY-MM') as month, file_sha256 from sales_reports`
      ).map((r) => [r.month, r.file_sha256])
    );

    const problems: string[] = [];
    const byMonth = new Map<string, SalesReportLink>();
    for (const link of links) {
      if (!link.fileMonth || !link.labelMonth || link.fileMonth !== link.labelMonth) {
        problems.push(`${link.url}: link says ${link.labelMonth ?? "?"} but file name says ${link.fileMonth ?? "?"}`);
        continue;
      }
      if (byMonth.has(link.fileMonth)) {
        problems.push(`${link.fileMonth}: more than one report link`);
        continue;
      }
      byMonth.set(link.fileMonth, link);
    }

    const months = [...byMonth.keys()].sort();
    const recheck = new Set(months.slice(-ALWAYS_RECHECK));
    const imported: string[] = [];
    const unchanged: string[] = [];
    let skipped = 0;

    for (const month of months) {
      const link = byMonth.get(month)!;
      if (existing.has(month) && !refresh && !recheck.has(month)) {
        skipped++;
        continue;
      }
      try {
        const buf = await downloadSalesReport(link.url);
        const sha = createHash("sha256").update(buf).digest("hex");
        if (existing.get(month) === sha) {
          unchanged.push(month);
          continue;
        }
        const report = parseSalesReport(buf);
        if (report.titleMonth !== month || report.fiscalMonth !== month) {
          problems.push(
            `${month}: file title says ${report.titleMonth} (${report.fiscalLabel} = ${report.fiscalMonth})`
          );
          continue;
        }
        const sumDollars = report.lines.reduce((s, l) => s + (l.dollars ?? 0), 0);
        if (
          report.reportedDollars != null &&
          Math.abs(sumDollars - report.reportedDollars) > RECONCILE_TOLERANCE
        ) {
          problems.push(
            `${month}: lines add up to $${sumDollars.toFixed(2)} but DABS reports $${report.reportedDollars.toFixed(2)}`
          );
          continue;
        }

        const codeCounts = new Map<string, number>();
        for (const l of report.lines) codeCounts.set(l.itemCode, (codeCounts.get(l.itemCode) ?? 0) + 1);
        const period = `${month}-01`;

        await sql.begin(async (tx) => {
          const t = tx as unknown as typeof sql;
          await t`delete from sales_reports where period_month = ${period}`;
          await t`
            insert into sales_reports ${t({
              period_month: period,
              fiscal_label: report.fiscalLabel,
              link_label: link.label,
              source_url: link.url,
              file_sha256: sha,
              lines: report.lines.length,
              item_codes: codeCounts.size,
              reused_codes: [...codeCounts.values()].filter((n) => n > 1).length,
              sum_dollars: Math.round(sumDollars * 100) / 100,
              reported_dollars: report.reportedDollars,
              sum_bottles: report.lines.reduce((s, l) => s + (l.bottles ?? 0), 0),
            })}`;
          for (let i = 0; i < report.lines.length; i += 1000) {
            const chunk = report.lines.slice(i, i + 1000).map((l) => ({
              period_month: period,
              line: l.line,
              item_code: l.itemCode,
              item_name: l.itemName,
              class_code: l.classCode,
              class_name: l.className,
              size_ml: l.sizeMl,
              bottles: l.bottles,
              dollars: l.dollars,
              status: l.status,
              raw: t.json(l.raw as never),
            }));
            await t`
              insert into monthly_sales ${t(
                chunk,
                "period_month", "line", "item_code", "item_name", "class_code", "class_name",
                "size_ml", "bottles", "dollars", "status", "raw"
              )}`;
          }
        });
        imported.push(month);
      } catch (err) {
        problems.push(`${month}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Codes in the newest report that the catalog doesn't know (not an error:
    // the catalog only lists what DABS's locator returns).
    const [unmatched] = await sql<{ codes: number; sample: string[] | null }[]>`
      with latest as (
        select distinct on (item_code) item_code, item_name
        from monthly_sales
        where period_month = (select max(period_month) from sales_reports)
        order by item_code, line
      )
      select count(*)::int as codes,
             (array_agg(l.item_code || ' ' || coalesce(l.item_name, '') order by l.item_code))[1:5] as sample
      from latest l
      where not exists (select 1 from products p where p.csc = l.item_code)`;

    const detail = {
      reports_listed: links.length,
      imported,
      unchanged,
      skipped,
      latest_unmatched_codes: unmatched.codes,
      latest_unmatched_sample: unmatched.sample ?? [],
      problems,
    };
    if (problems.length) {
      throw new Error(`sales import: ${problems.length} problem(s): ${problems.join(" | ").slice(0, 1500)}`);
    }
    return detail;
  });
}
