import type { Sql } from "postgres";
import { HAIKU_PRICE_PER_MTOK } from "../lib/taste/interpret";

/**
 * report.yml → taste: pilot coverage and evidence quality, the sample review,
 * and usage (searches by kind, clicks, watches, feedback, model latency and
 * cost). Read-only, aggregated; no visitor ids are printed.
 */
export async function tasteReport(sql: Sql, days = 14) {
  const show = (title: string, rows: unknown) =>
    console.log(`\n## ${title}\n${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n{")}`);

  show("pilot wines", await sql`
    select w.pilot_group, count(*)::int as wines,
           count(*) filter (where p.description is not null)::int as with_listing_text,
           count(*) filter (where w.generic_description)::int as generic_text,
           count(*) filter (where w.identity_status <> 'ok')::int as ambiguous_identity,
           count(*) filter (where p.in_stock)::int as in_stock,
           count(*) filter (where p.store_checked_at > now() - interval '72 hours')::int as store_checked_72h
    from wine_profiles w join products p using (csc) group by rollup (1) order by 1`);
  for (const attr of ["sweetness", "body", "grapes", "region"]) {
    show(`${attr}: evidence kind × source`, await sql`
      select profile->${attr}->>'evidence' as evidence, profile->${attr}->>'source' as source,
             profile->${attr}->>'confidence' as confidence, count(*)::int as wines
      from wine_profiles where identity_status = 'ok' group by 1, 2, 3 order by 4 desc`);
  }
  show("style tags by evidence", await sql`
    select t->>'value' as tag, t->>'evidence' as evidence, count(*)::int as wines
    from wine_profiles, jsonb_array_elements(profile->'tags') t group by 1, 2 order by 3 desc`);
  show("sample review", await sql`
    select r.verdict, count(*)::int as profiles,
           count(*) filter (where r.reviewed_values is distinct from jsonb_build_object(
             'grapes', w.profile->'grapes'->'value', 'region', w.profile->'region'->'value',
             'fizz', w.profile->'fizz'->'value', 'sweetness', w.profile->'sweetness'->'value',
             'body', w.profile->'body'->'value',
             'tags', (select coalesce(jsonb_agg(t->'value'), '[]'::jsonb) from jsonb_array_elements(w.profile->'tags') t)))::int
             as changed_since_review
    from wine_profile_reviews r join wine_profiles w using (csc) group by 1`);
  show("manual overrides", await sql`select csc, attribute, value, note, reviewed_on from wine_profile_overrides order by reviewed_on desc`);

  show(`searches, last ${days} days (name = /search views with words and no taste picks)`, await sql`
    with taste as (
      select mode, count(*)::int as n, count(distinct visitor_id)::int as visitors
      from taste_events where kind = 'shown' and created_at > now() - make_interval(days => ${days}) group by 1
    )
    select 'name' as kind, (select count(*)::int from page_events where path = '/search' and search_query is not null
                            and created_at > now() - make_interval(days => ${days}))
                          - coalesce((select sum(n)::int from taste where mode = 'typed'), 0) as views, null::int as visitors
    union all select mode, n, visitors from taste`);
  show("taste picks: shown, clicked, watched, feedback", await sql`
    select mode,
           count(*) filter (where kind = 'shown')::int as shown,
           count(*) filter (where kind = 'shown' and results = 0)::int as shown_empty,
           count(*) filter (where kind = 'click')::int as clicks,
           count(*) filter (where kind = 'watch_click')::int as watch_clicks,
           count(*) filter (where kind = 'feedback' and useful)::int as useful,
           count(*) filter (where kind = 'feedback' and not useful)::int as not_useful
    from taste_events where kind <> 'interpret' and created_at > now() - make_interval(days => ${days})
    group by rollup (1) order by 1`);
  show("confirmed watches from taste picks (added to a watchlist; clicks alone don't count)", await sql`
    select count(*)::int as watches, count(distinct user_id)::int as accounts,
           (select count(*)::int from watch_intents where source = 'taste' and applied_at is null
              and created_at > now() - interval '24 hours') as pending_sign_in
    from watchlist where source = 'taste' and created_at > now() - make_interval(days => ${days})`);
  const [m] = (await sql`
    select count(*)::int as calls, count(*) filter (where model_ok)::int as ok,
           percentile_cont(0.5) within group (order by model_ms)::int as p50_ms,
           percentile_cont(0.9) within group (order by model_ms)::int as p90_ms,
           max(model_ms)::int as max_ms,
           coalesce(sum(input_tokens), 0)::int as input_tokens, coalesce(sum(output_tokens), 0)::int as output_tokens
    from taste_events where kind = 'interpret' and created_at > now() - make_interval(days => ${days})`) as unknown as {
    calls: number; ok: number; p50_ms: number; p90_ms: number; max_ms: number; input_tokens: number; output_tokens: number;
  }[];
  const cost = (m.input_tokens * HAIKU_PRICE_PER_MTOK.input + m.output_tokens * HAIKU_PRICE_PER_MTOK.output) / 1e6;
  show("model step (Haiku 4.5, only for words the rules can't read)", [
    { ...m, cost_usd: Math.round(cost * 10000) / 10000, cost_per_call_usd: m.calls ? Math.round((cost / m.calls) * 1e6) / 1e6 : null },
  ]);
  show("most common typed taste requests (structured, no free text)", await sql`
    select request - 'area' - 'grape' as request, count(*)::int as n from taste_events
    where kind = 'shown' and mode = 'typed' and created_at > now() - make_interval(days => ${days})
    group by 1 order by 2 desc limit 10`);
  return sql.end();
}

/** report.yml → searchlog: wine-related search words people typed (counts only). */
export async function searchLog(sql: Sql, days = 30) {
  const rows = await sql`
    select lower(trim(search_query)) as q, count(*)::int as searches, count(distinct visitor_id)::int as visitors
    from page_events
    where path = '/search' and search_query is not null and created_at > now() - make_interval(days => ${days})
    group by 1 order by 2 desc limit 300`;
  const wine = /wine|red|white|ros[eé]|sparkling|prosecco|champagne|chard|cab|pinot|merlot|riesling|moscato|sauv|zin|malbec|sweet|dry|bubbly|blush|syrah|shiraz/;
  console.log(`\n## wine-related searches, last ${days} days (from ${rows.length} distinct queries)`);
  for (const r of rows as unknown as { q: string; searches: number; visitors: number }[]) {
    if (wine.test(r.q)) console.log(`${String(r.searches).padStart(4)} (${r.visitors} visitors)  ${r.q}`);
  }
  return sql.end();
}
