import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Runs the taste-search evaluation set (lib/taste/eval-cases.ts) against a
 * database: the same reading, merging and ranking the /search page uses,
 * without the model step. Read-only. Checks, per case:
 *   - the request is read as expected (hard constraints and preferences),
 *   - name searches stay name searches and find the right bottle,
 *   - every pick passes the hard constraints (kind, grape, price, area stock
 *     checked in the last 72h, ordinary retail listing, clear identity),
 *   - every quoted reason is verbatim DABS text for that product, and style
 *     notes are only used where the profile says "style",
 *   - fully supported picks rank above ones missing a requested preference.
 * Usage: npx tsx scripts/taste-eval.ts [--verbose]   (report.yml → tasteeval)
 */
export async function runTasteEval(verbose = false): Promise<number> {
  const { sql } = await import("../lib/db");
  const { EVAL_CASES } = await import("../lib/taste/eval-cases");
  const { parseTasteText } = await import("../lib/taste/parse");
  const { resolveRequest, isTasteSearch, requestFromParams } = await import("../lib/taste/request");
  const { recommend, RECO_STORE_MAX_AGE_HOURS } = await import("../lib/taste/recommend");
  const { followUps, clarification } = await import("../lib/taste/view");
  const { searchProducts } = await import("../lib/queries");
  const { storeLabel } = await import("../lib/format");

  const areaRows = (await sql`
    select city, avg(lat)::float8 as lat, avg(lng)::float8 as lng from stores
    where city is not null and lat is not null group by city`) as unknown as { city: string; lat: number; lng: number }[];
  const areas = areaRows.map((r) => ({ label: storeLabel(r.city).title, lat: r.lat, lng: r.lng }));
  const labels = areas.map((a) => a.label);
  const findArea = (l: string | null) => (l ? areas.find((a) => a.label.toLowerCase() === l.toLowerCase()) ?? null : null);

  let failures = 0;
  const lines: string[] = [];
  const byGroup = new Map<string, { pass: number; fail: number }>();

  for (const c of EVAL_CASES) {
    const problems: string[] = [];
    const params = c.params ?? {};
    const picker = findArea(c.picker ?? null);
    const typed = c.q ? parseTasteText(c.q, labels) : null;
    const exact = c.q ? await searchProducts({ q: c.q }) : { total: 0, rows: [] as { name: string }[] };
    const taste = isTasteSearch(typed, params, exact.total, false);
    if (taste !== c.expect.taste) problems.push(`taste mode ${taste}, expected ${c.expect.taste}`);
    if (c.expect.nameTop && !exact.rows[0]?.name.toUpperCase().includes(c.expect.nameTop)) {
      problems.push(`name search top "${exact.rows[0]?.name ?? "none"}", expected ${c.expect.nameTop}`);
    }

    let resolved = resolveRequest(typed, params, picker?.label ?? null);
    const defaults = resolveRequest(typed, {}, picker?.label ?? null).request;
    let outcome: Awaited<ReturnType<typeof recommend>> | null = null;
    const area = () => (resolved.request.area === "me" ? picker : findArea(resolved.request.area));
    const catalogAsOf = new Date();

    if (taste || c.expect.type !== undefined) {
      if (c.followup) {
        const first = await recommend({ ...resolved.request, area: area() ? resolved.request.area : null }, area(), catalogAsOf);
        const f = followUps(resolved.request, defaults, c.q ? { q: c.q } : {}, first).find((x) => x.key === c.followup);
        if (!f?.href) {
          if (c.expect.sweet !== resolved.request.sweet) problems.push(`follow-up ${c.followup} unavailable`);
        } else {
          const next = Object.fromEntries(new URLSearchParams(f.href.split("?")[1]));
          resolved = resolveRequest(typed, { ...params, ...next }, picker?.label ?? null);
          if (!requestFromParams(next).type && resolved.request.type !== defaults.type) problems.push("follow-up lost the wine type");
        }
      }
      const r = resolved.request;
      const e = c.expect;
      const check = (k: keyof typeof r, v: unknown) => {
        if (v === undefined) return;
        const got = r[k];
        if (JSON.stringify(Array.isArray(got) ? [...got].sort() : got) !== JSON.stringify(Array.isArray(v) ? [...v].sort() : v)) {
          problems.push(`${k}=${JSON.stringify(got)}, expected ${JSON.stringify(v)}`);
        }
      };
      check("type", e.type);
      check("maxPrice", e.maxPrice);
      check("minPrice", e.minPrice);
      check("area", e.area);
      check("sweet", e.sweet);
      check("body", e.body);
      check("novelty", e.novelty);
      check("grape", e.grape);
      if (e.tags) for (const t of e.tags) if (!r.tags.includes(t as never)) problems.push(`missing tag ${t}`);
      if (e.unused) for (const w of e.unused) if (!resolved.unused.includes(w)) problems.push(`"${w}" not reported as unused`);
      if (e.clarify !== undefined) {
        const cl = clarification(resolved, defaults, {}, !!area() || r.area !== "me");
        if ((cl?.kind ?? null) !== e.clarify) problems.push(`clarify=${cl?.kind ?? null}, expected ${e.clarify}`);
      }

      if (taste) {
        const a = area();
        outcome = await recommend({ ...r, area: a ? r.area : null }, a, catalogAsOf);
        const res = outcome.results;
        if (e.minResults && res.length < e.minResults) problems.push(`${res.length} picks, expected ≥ ${e.minResults}`);
        if (e.empty && res.length) problems.push(`expected no picks, got ${res.length}`);
        if (res.length > 6) problems.push("more than 6 picks");

        // Hard constraints and evidence, straight from the database.
        const cscs = res.map((x) => x.csc);
        const facts = (await sql`
          select p.csc, p.name, p.description, p.current_price::float8 as price, p.in_stock, p.delisted_at, p.status,
                 w.pilot_group, w.identity_status, w.profile
          from products p join wine_profiles w using (csc) where p.csc = any(${cscs})`) as unknown as {
          csc: string; name: string; description: string | null; price: number; in_stock: boolean; delisted_at: Date | null;
          status: string | null; pilot_group: string; identity_status: string; profile: { grapes: { value: string[] | null } };
        }[];
        const byCsc = new Map(facts.map((f) => [f.csc, f]));
        let sawUnknown = false;
        for (const x of res) {
          const f = byCsc.get(x.csc)!;
          if (!f.in_stock || f.delisted_at || ["A", "N", "S", "X"].includes(f.status ?? "")) problems.push(`${x.csc} not ordinary retail stock`);
          if (f.identity_status !== "ok") problems.push(`${x.csc} ambiguous identity`);
          if (r.maxPrice != null && f.price > r.maxPrice) problems.push(`${x.csc} $${f.price} over $${r.maxPrice}`);
          if (r.minPrice != null && f.price < r.minPrice) problems.push(`${x.csc} $${f.price} under $${r.minPrice}`);
          if (r.type && f.pilot_group !== r.type) problems.push(`${x.csc} is ${f.pilot_group}, not ${r.type}`);
          if (r.grape && !(f.profile.grapes.value ?? []).includes(r.grape)) problems.push(`${x.csc} not ${r.grape}`);
          if (a) {
            if (!x.near || x.near.stores < 1) problems.push(`${x.csc} has no stock near ${a.label}`);
            else if (Date.now() - new Date(x.near.checkedAt).getTime() > RECO_STORE_MAX_AGE_HOURS * 3600_000) problems.push(`${x.csc} near-stock check too old`);
          }
          // Quotes must be DABS's own words for this product.
          for (const m of x.reason.matchAll(/“([^”]+)”/g)) {
            const quote = m[1].replace(/…$/, "");
            // Listing text verbatim; label words from the DABS name (upper case).
            const src = `${f.description ?? ""} ${f.name.toLowerCase()}`;
            if (!src.includes(quote) && !f.name.toUpperCase().includes(quote.toUpperCase())) problems.push(`${x.csc} quote not in DABS text: “${quote.slice(0, 40)}…”`);
          }
          if (/\b\d{2,3}\s*(points?|pts)\b|award|medal|pairs? (well )?with/i.test(x.reason)) problems.push(`${x.csc} reason makes a rating/pairing claim`);
          if (x.reason.startsWith("Style note") && !x.evidence.some((ev) => ev.kind === "style")) problems.push(`${x.csc} style note without style evidence`);
          if (x.unknowns.length) sawUnknown = true;
          else if (sawUnknown) problems.push(`${x.csc} fully supported but ranked below a pick with unknowns`);
        }
      }
    }

    const ok = problems.length === 0;
    if (!ok) failures++;
    const g = byGroup.get(c.group) ?? { pass: 0, fail: 0 };
    g[ok ? "pass" : "fail"]++;
    byGroup.set(c.group, g);
    const picks = outcome?.results.map((x) => `${x.name.replace(/\s+\d+\s?ml$/i, "")} $${x.price}`).join("; ");
    lines.push(`${ok ? "PASS" : "FAIL"} ${c.id}${problems.length ? `\n     ${problems.join("\n     ")}` : ""}`);
    if (verbose && outcome) {
      lines.push(`     ${outcome.results.length} picks (eligible ${outcome.eligible}, unknown-near ${outcome.unknownNear}, no-info ${outcome.noInfo})${picks ? `: ${picks}` : ""}`);
      for (const x of outcome.results.slice(0, 3)) lines.push(`       · ${x.reason.slice(0, 150)}`);
    }
  }

  console.log(lines.join("\n"));
  console.log(`\n${EVAL_CASES.length - failures}/${EVAL_CASES.length} cases pass`);
  for (const [g, n] of byGroup) console.log(`  ${g.padEnd(14)} ${n.pass}/${n.pass + n.fail}`);
  return failures;
}

if (process.argv[1]?.endsWith("taste-eval.ts")) {
  runTasteEval(process.argv.includes("--verbose")).then(
    (f) => process.exit(f ? 1 : 0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
