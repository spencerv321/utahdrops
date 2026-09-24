import { sql } from "@/lib/db";
import { assessAll, RARITY_METHOD, TIER_ORDER } from "@/lib/rarity";
import { parseSizeMl } from "@/lib/dabs/client";
import { withRun } from "./run";

/** Fewer assessments than this means an input failed to load; keep yesterday's. */
const MIN_ROWS = 1000;

/**
 * Recomputes the availability assessment for every shelf product (plus
 * not-listed bottles from DABS drawings) and swaps product_rarity in one
 * transaction. Drawing bottles DABS no longer lists get a product row marked
 * delisted, so they have a "Not currently listed" page.
 */
export async function runRarityJob() {
  return withRun("rarity", async () => {
    const db = await sql.reserve();
    try {
      await db`set client_min_messages = warning`;
      const { rows, drawings, history } = await assessAll(db);
      const keep = rows.filter((a) => a.r.label !== "Special order" && a.r.label !== "Being discontinued");
      if (keep.length < MIN_ROWS) throw new Error(`only ${keep.length} assessments — an input likely failed; not writing`);

      // Pages for drawing bottles not in the catalog (identity = exact item code).
      const missing = rows.filter((a) => !a.stock && drawings.has(a.code));
      for (const a of missing) {
        const d = drawings.get(a.code)![0];
        await db`
          insert into products (csc, name, category, size_ml, status, current_price, in_stock, store_qty, delisted_at)
          values (${a.code}, ${a.name}, ${history.get(a.code)?.className ?? null}, ${parseSizeMl(a.name)},
                  ${a.status}, ${d.price}, false, 0, now())
          on conflict (csc) do nothing`;
      }

      // Swap in one transaction on this connection (it holds the temp tables).
      await db`begin`;
      try {
        await db`delete from product_rarity`;
        for (let i = 0; i < keep.length; i += 500) {
          await db`
            insert into product_rarity ${db(
              keep.slice(i, i + 500).map((a) => ({
                csc: a.code,
                tier: a.r.tier,
                published: a.r.publish,
                label: a.r.label,
                headline: a.r.headline,
                explanation: a.r.explanation,
                evidence: db.json(a.r.evidence as never),
                confidence: a.r.confidence,
                blocked_by: a.r.blockedBy,
                reason: a.r.reason,
                method: RARITY_METHOD,
              })),
              "csc", "tier", "published", "label", "headline", "explanation", "evidence",
              "confidence", "blocked_by", "reason", "method"
            )}`;
        }
        await db`commit`;
      } catch (err) {
        await db`rollback`.catch(() => {});
        throw err;
      }

      const byTier: Record<string, number> = {};
      for (const a of keep) if (a.r.publish && a.r.tier) byTier[a.r.tier] = (byTier[a.r.tier] ?? 0) + 1;
      return {
        method: RARITY_METHOD,
        assessed: keep.length,
        published: Object.fromEntries(TIER_ORDER.map((t) => [t, byTier[t] ?? 0])),
        blocked: keep.filter((a) => a.r.tier && !a.r.publish).length,
        not_listed_pages_added: missing.length,
      };
    } finally {
      await db`drop table if exists rarity_days, rarity_pd, rarity_store_days`.catch(() => {});
      db.release();
    }
  });
}
