/**
 * Search impression counts against a real Postgres (see CLAUDE.md for local
 * setup). Run: pnpm test:db. Uses its own visitor ids; cleans up.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../../lib/db";
import { searchClicksByRank, searchImpressions } from "../../lib/search-report";

const V = "search-report-test";
let since: string;

async function shown(view: string, query: string | null, results: number) {
  await sql`insert into discover_events (kind, surface, view, visitor_id, query, results)
            values ('shown', 'search', ${view}, ${V}, ${query}, ${results})`;
}

before(async () => {
  await sql`delete from discover_events where visitor_id = ${V}`;
  // Only this test's rows: everything written from now on.
  const [{ now }] = await sql<{ now: string }[]>`select (now() - interval '1 second')::text as now`;
  since = now;
  // Same visitor searches gin twice: nothing matched, then 12 did.
  await shown("exact", "gin", 0);
  await shown("exact", "gin", 12);
  // The same 12 matches re-sorted (an equal-count list change the page reports again).
  await shown("exact", "gin", 12);
  // Filter-only browsing: two different filter sets, no words.
  await shown("browse", null, 400);
  await shown("browse", null, 35);
  await sql`insert into discover_events (kind, surface, view, csc, visitor_id, rank, results, query) values
            ('click', 'search', 'exact', '000001', ${V}, 2, 12, 'gin'),
            ('click', 'search', 'browse', '000002', ${V}, 30, 400, null)`;
});

after(async () => {
  await sql`delete from discover_events where visitor_id = ${V}`;
  await sql.end();
});

test("each displayed list is one impression; repeated queries aren't merged", async () => {
  const rows = Object.fromEntries((await searchImpressions(sql, since)).map((r) => [r.view, r]));
  assert.equal(rows.exact.impressions, 3);
  assert.equal(rows.exact.zero_results, 1, "the first, empty gin search still counts as zero-result");
  assert.equal(rows.browse.impressions, 2);
  assert.equal(rows.browse.zero_results, 0);
});

test("clicks are raw counts by rank", async () => {
  const rows = await searchClicksByRank(sql, since);
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { rank: "2", clicks: 1 },
    { rank: "25+", clicks: 1 },
  ]);
});
