import type { sql as Sql } from "@/lib/db";

/**
 * Search impressions from discover_events (report.yml -> funnel). One row per
 * `shown` event = one displayed result list (components/search-track.tsx), so
 * a repeated query, a filter change or a new page each count once. No click-
 * through rate: clicks aren't tied to a specific impression, so dividing them
 * would credit one list with another's click.
 */
export async function searchImpressions(sql: typeof Sql, since: string) {
  return sql<{ view: string; impressions: number; zero_results: number; zero_pct: number | null; median_results: number | null }[]>`
    select view,
           count(*)::int as impressions,
           count(*) filter (where results = 0)::int as zero_results,
           round(100.0 * count(*) filter (where results = 0) / nullif(count(*), 0), 1)::float8 as zero_pct,
           percentile_cont(0.5) within group (order by results)::int as median_results
    from discover_events
    where created_at >= ${since} and surface = 'search' and kind = 'shown'
    group by view order by view`;
}

/** Result clicks by 1-based rank (raw counts; not a rate). */
export async function searchClicksByRank(sql: typeof Sql, since: string) {
  return sql<{ rank: string; clicks: number }[]>`
    select case when rank <= 3 then rank::text when rank <= 10 then '4-10' when rank <= 24 then '11-24' else '25+' end as rank,
           count(*)::int as clicks
    from discover_events
    where created_at >= ${since} and surface = 'search' and kind = 'click' and rank is not null
    group by 1 order by min(rank)`;
}
