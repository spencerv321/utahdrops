import { sql } from "@/lib/db";
import { withRun } from "@/lib/jobs/run";
import { selectPilotWines } from "@/lib/taste/pilot";
import { PILOT_WINES } from "@/lib/taste/pilot-list";
import { REVIEW_LOG, REVIEWED_ON, REVIEWER } from "@/lib/taste/review-log";
import { EXTRACTOR_VERSION, GENERIC_DESCRIPTION_MIN, checkIdentity, extractProfile, inputHash } from "@/lib/taste/profile";

/**
 * Builds taste profiles for the pilot wines (lib/taste/profile.ts). The pilot
 * is the reviewed list in lib/taste/pilot-list.ts; `reselect` adds a fresh
 * stratified selection (lib/taste/pilot.ts) on top, for a later round. Each profile is re-extracted
 * only when its inputs or the extractor change; manual corrections live in
 * wine_profile_overrides and are never touched here.
 */
export async function runTasteProfilesJob(opts: { reselect?: boolean } = {}) {
  return withRun("taste_profiles", async () => {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from wine_profiles`;
    let selected = 0;
    if (n === 0 || opts.reselect) {
      const pilot = opts.reselect
        ? await selectPilotWines()
        : Object.entries(PILOT_WINES).flatMap(([grp, cscs]) => cscs.map((csc) => ({ csc, grp })));
      const rows = pilot.map((p) => ({ csc: p.csc, pilot_group: p.grp }));
      if (rows.length) {
        const res = await sql`
          insert into wine_profiles (csc, pilot_group, profile, input_hash, extractor_version)
          select x.csc, x.pilot_group, '{}'::jsonb, '', ''
          from jsonb_to_recordset(${sql.json(rows as never)}) as x(csc text, pilot_group text)
          where exists (select 1 from products p where p.csc = x.csc)
          on conflict (csc) do nothing`;
        selected = res.count;
      }
    }

    const products = await sql<
      {
        csc: string; name: string; category: string | null; size_ml: number | null; description: string | null;
        store_checked_at: Date | null; input_hash: string; shared: number; rarity_block: string | null;
      }[]
    >`
      select p.csc, p.name, p.category, p.size_ml, p.description, p.store_checked_at, w.input_hash,
             (select count(*)::int from products d where d.description = p.description) as shared,
             pr.blocked_by as rarity_block
      from wine_profiles w
      join products p using (csc)
      left join product_rarity pr using (csc)`;

    let extracted = 0;
    let ambiguous = 0;
    for (const p of products) {
      const input = { name: p.name, category: p.category, sizeMl: p.size_ml, description: p.description };
      let identity = checkIdentity(p.name);
      if (identity.status === "ok" && p.rarity_block?.startsWith("DABS code")) {
        identity = { status: "ambiguous", note: p.rarity_block };
      }
      if (identity.status === "ambiguous") ambiguous++;
      const hash = inputHash(input) + (identity.status === "ok" ? "" : ":ambiguous");
      if (hash === p.input_hash) continue;
      const generic = !!p.description && p.shared >= GENERIC_DESCRIPTION_MIN;
      const profile = extractProfile(input, { genericDescription: generic });
      await sql`
        update wine_profiles set
          profile = ${sql.json(profile as never)},
          input_hash = ${hash},
          extractor_version = ${EXTRACTOR_VERSION},
          identity_status = ${identity.status},
          identity_note = ${identity.note},
          generic_description = ${generic},
          source_read_at = ${p.store_checked_at},
          extracted_at = now()
        where csc = ${p.csc}`;
      extracted++;
    }

    // The committed sample review (lib/taste/review-log.ts is the record; a
    // re-check there updates the row, nothing here changes a verdict).
    const reviews = REVIEW_LOG.map((r) => ({ csc: r.csc, verdict: r.verdict, note: r.note ?? null, values: r.values }));
    await sql`
      insert into wine_profile_reviews (csc, verdict, note, reviewer, reviewed_on, reviewed_values)
      select x.csc, x.verdict, x.note, ${REVIEWER}, ${REVIEWED_ON}::date, x.values
      from jsonb_to_recordset(${sql.json(reviews as never)}) as x(csc text, verdict text, note text, values jsonb)
      where exists (select 1 from products p where p.csc = x.csc)
      on conflict (csc) do update set
        verdict = excluded.verdict, note = excluded.note, reviewer = excluded.reviewer,
        reviewed_on = excluded.reviewed_on, reviewed_values = excluded.reviewed_values`;

    return { pilot: products.length, selected, extracted, unchanged: products.length - extracted, ambiguous };
  });
}
