import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { assessAll, isAllocatedLabel, RARITY_METHOD, T, TIER_LABELS, TIER_ORDER, type Assessment } from "../lib/rarity";

/**
 * `report.ts rarity`: internal review of the availability assessment (beta).
 * Uses the same assessAll() as the `rarity` job, so what this prints is what
 * the job would publish. Every Rare/Unicorn that would publish is listed in
 * full for manual review; other tiers are sampled.
 */
export async function rarityReport(sql: Sql) {
  const out = (s = "") => console.log(s);
  const head = (s: string) => out(`\n## ${s}`);
  const db = await sql.reserve();
  try {
    await db`set client_min_messages = warning`;
    const t0 = Date.now();
    const { rows, ctx, history, drawings, drops, dropNamesUnmatched } = await assessAll(db);
    const cov = ctx.coverage;

    head(`method ${RARITY_METHOD} — beta review (built in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    out(`DABS drawing → Unicorn if its latest drawing offered ≤${T.unicornDrawingBottles} bottles, else Rare (entries per bottle is shown as a fact)`);
    out(`Allocated release (drops support, shelf evidence decides when in stock ≥${T.shelfDecides * 100}% of observed days):`);
    out(`  Rare only if drops total ≤${T.rareDropTotalBottles} bottles AND ≤${T.rareMaxSales12} bottles sold in 12 months AND rarely on shelves (<${T.hardToFind * 100}%); else Scarce`);
    out(`Hard to find (<${T.hardToFind * 100}% of observed days, seen in stock at least once, plus a sellout or sales while watched) → Scarce`);
    out(`Intermittently available (${T.hardToFind * 100}–${T.consistently * 100}%) → Uncommon; ≥${T.consistently * 100}%: typically ≥${T.wideStores} stores → Everyday, fewer → Usually at a few stores (Uncommon)`);
    out(`published = tier set AND confidence not low AND (for Scarce and up) the DABS code has one name/vintage in the sales files`);

    head("coverage");
    out(`stock observations: ${cov.observedDays} of ${cov.spanDays} days (${cov.first} → ${cov.last}); Nov–Dec observed: ${cov.holidayObserved}`);
    for (const g of cov.gaps) out(`  excluded gap: ${g.days} day(s) after ${g.after}`);
    out(`sales window ${ctx.salesFrom} → ${ctx.salesTo}; watched months: ${ctx.watchedMonths.join(", ") || "none"}`);
    out(`drawings: ${[...drawings.values()].reduce((a, d) => a + d.length, 0)} entries for ${drawings.size} codes; allocated-drop codes: ${drops.size}; unmatched drop names: ${dropNamesUnmatched.join("; ") || "none"}`);

    const stored = rows.filter((x) => x.r.label !== "Special order" && x.r.label !== "Being discontinued");
    head("what the job would store and publish");
    for (const [k, n] of [...countBy(stored, (x) => `${x.r.label.padEnd(26)} ${x.r.tier ? TIER_LABELS[x.r.tier].padEnd(9) : "—".padEnd(9)} ${x.r.publish ? "published" : x.r.tier ? `blocked: ${x.r.blockedBy}` : ""}`)].sort((a, b) => b[1] - a[1])) {
      out(`${String(n).padStart(6)}  ${k}`);
    }
    out("published per tier: " + [...TIER_ORDER].reverse().map((t) => `${TIER_LABELS[t]} ${stored.filter((x) => x.r.publish && x.r.tier === t).length}`).join(" · "));
    out(`not-listed bottles with a page (drawings): ${stored.filter((x) => x.r.notListed && drawings.has(x.code)).length}`);

    for (const t of ["unicorn", "rare"] as const) {
      const g = stored.filter((x) => x.r.publish && x.r.tier === t);
      head(`${TIER_LABELS[t]} — all ${g.length} that would publish (review each)`);
      g.sort((a, b) => a.name.localeCompare(b.name)).forEach((x) => out(fmt(x)));
    }
    const pick = (arr: Assessment[], n: number, seed: string) =>
      [...arr].sort((a, b) => hash(seed + a.code).localeCompare(hash(seed + b.code))).slice(0, n);
    for (const t of ["scarce", "uncommon", "everyday"] as const) {
      const g = stored.filter((x) => x.r.publish && x.r.tier === t);
      head(`${TIER_LABELS[t]} — ${Math.min(12, g.length)} random of ${g.length} that would publish`);
      pick(g, 12, t).forEach((x) => out(fmt(x)));
    }
    head("blocked from publishing (tier computed, badge withheld)");
    for (const [k, n] of countBy(stored.filter((x) => x.r.tier && !x.r.publish), (x) => x.r.blockedBy!.replace(/\d+/g, "N"))) out(`${String(n).padStart(6)}  ${k}`);
    pick(stored.filter((x) => x.r.tier && !x.r.publish && TIER_ORDER.indexOf(x.r.tier) >= 2), 12, "blocked").forEach((x) => out(fmt(x)));

    head("reference bottles");
    const famous = /VAN WINKLE|GEORGE T STAGG|STAGG BOURBON|BLANTON BOURBON SNGL|WELLER 12|E H TAYLOR SMALL|EAGLE RARE 10 YR BOURBON 750|BUFFALO TRACE BOURBON 750|TITOS HANDMADE VODKA 750|LAPHROAIG CAIRDEAS|OLD FORESTER 1924|CHARTREUSE GREEN VEP|SKREWBALL EGGNOG|HORSE SOLDIER LIBERTY|EL TESORO TEQ REPO BSL|GHOSTFISH/i;
    stored.filter((x) => famous.test(x.name)).sort((a, b) => a.name.localeCompare(b.name)).forEach((x) => out(fmt(x)));

    head("questionable");
    const q = (title: string, g: Assessment[], n = 8) => {
      out(`-- ${title}: ${g.length}`);
      g.slice(0, n).forEach((x) => out(fmt(x)));
    };
    q("published Everyday/Uncommon but carrying DABS's allocated label", stored.filter((x) => x.r.publish && (x.r.tier === "everyday" || x.r.tier === "uncommon") && isAllocatedLabel(x.status, x.className)));
    q("published Scarce+ with ≥1,000 bottles sold in 12 months", stored.filter((x) => x.r.publish && TIER_ORDER.indexOf(x.r.tier!) >= 2 && x.sales.bottles12 >= 1000));
    q("published Scarce+ on shelves right now at ≥10 stores (fresh checks)", stored.filter((x) => x.r.publish && TIER_ORDER.indexOf(x.r.tier!) >= 2 && (x.stock?.stores_now ?? 0) >= 10));
    q("reused item codes (blocked) among Scarce+", stored.filter((x) => x.r.blockedBy?.startsWith("DABS code") && TIER_ORDER.indexOf(x.r.tier!) >= 2).map((x) => ({ ...x, name: `${x.name}  ⚑ ${history.get(x.code)?.names.join(" / ")}` })));
  } finally {
    await db`drop table if exists rarity_days, rarity_pd, rarity_store_days`.catch(() => {});
    db.release();
  }
  await sql.end();
}

function fmt(x: Assessment): string {
  const r = x.r;
  const badge = r.tier ? `${TIER_LABELS[r.tier].toUpperCase()}${r.publish ? "" : " (withheld)"}` : "no badge";
  return `${badge} · ${r.headline} | ${x.name} [${x.code}] ${x.className ?? "?"}${r.notListed ? " · NOT CURRENTLY LISTED" : ""}\n` +
    `      "${r.explanation}"\n` +
    r.evidence.map((e) => `      • ${e}\n`).join("") +
    `      DABS labels: ${r.dabsLabels.join(", ") || "—"} · confidence ${r.confidence ?? "—"} · why: ${r.reason}`;
}

function hash(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

function countBy<X>(arr: X[], key: (x: X) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of arr) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
  return m;
}

