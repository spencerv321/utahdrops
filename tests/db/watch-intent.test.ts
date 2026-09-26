/**
 * Pending watch intent against a real Postgres (see CLAUDE.md for local
 * setup). Run: pnpm test:db (reads .env.local). Uses throwaway auth.users rows; cleans up.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../../lib/db";
import { applyWatchIntent, createWatchIntent, peekWatchIntent } from "../../lib/watch-intent";

const EMAIL = "watch-intent-test@example.com";
let user: { id: string; email: string };
let other: { id: string; email: string };
let csc: string;
let csc2: string;
let storeId: number;

before(async () => {
  await sql`delete from auth.users where email like 'watch-intent-test%'`;
  [user] = await sql<{ id: string; email: string }[]>`insert into auth.users (email) values (${EMAIL}) returning id, email`;
  [other] = await sql<{ id: string; email: string }[]>`
    insert into auth.users (email) values ('watch-intent-test-other@example.com') returning id, email`;
  const products = await sql<{ csc: string }[]>`select csc from products order by csc limit 2`;
  [csc, csc2] = products.map((p) => p.csc);
  const [store] = await sql<{ id: number }[]>`
    insert into stores (id, name, city) values (99990, 'STORE 99990 TEST', 'Testville')
    on conflict (id) do update set name = excluded.name returning id`;
  storeId = store.id;
});

after(async () => {
  await sql`delete from discover_events where visitor_id like 'visitor-test-%'`;
  await sql`delete from watch_intents where email like 'watch-intent-test%'`;
  await sql`delete from auth.users where email like 'watch-intent-test%'`;
  await sql`delete from stores where id = 99990`;
  await sql.end();
});

test("rejects unknown products and stores", async () => {
  assert.equal(await createWatchIntent(EMAIL, "000000", null), null);
  assert.equal(await createWatchIntent(EMAIL, csc, 123456), null);
});

test("adds the watch and store once; repeated callbacks change nothing", async () => {
  const id = (await createWatchIntent(EMAIL.toUpperCase(), csc, storeId))!;
  assert.deepEqual(await peekWatchIntent(id), { csc, storeId, source: null });

  const first = await applyWatchIntent(id, user);
  assert.equal(first.status, "added");
  assert.equal(first.store, "added");
  for (let i = 0; i < 3; i++) {
    const again = await applyWatchIntent(id, user);
    assert.equal(again.status, "already");
  }
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from watchlist where user_id = ${user.id} and csc = ${csc}`;
  assert.equal(n, 1, "still exactly one watch (not toggled off, not duplicated)");
  const stores = await sql`select 1 from user_stores where user_id = ${user.id} and store_id = ${storeId}`;
  assert.equal(stores.length, 1);
});

test("a second request for a bottle already watched keeps it watched", async () => {
  const id = (await createWatchIntent(EMAIL, csc, null))!;
  const r = await applyWatchIntent(id, user);
  assert.equal(r.status, "already");
  const w = await sql`select 1 from watchlist where user_id = ${user.id} and csc = ${csc}`;
  assert.equal(w.length, 1);
});

test("only the account with the requested email gets the watch", async () => {
  const id = (await createWatchIntent(EMAIL, csc2, null))!;
  const r = await applyWatchIntent(id, other);
  assert.equal(r.status, "mismatch");
  const w = await sql`select 1 from watchlist where user_id = ${other.id}`;
  assert.equal(w.length, 0);
  // The right account can still use it afterwards.
  assert.equal((await applyWatchIntent(id, user)).status, "added");
  // …and then nobody else can.
  assert.equal((await applyWatchIntent(id, other)).status, "mismatch");
});

test("expired requests add nothing", async () => {
  const id = (await createWatchIntent(EMAIL, csc2, null))!;
  await sql`update watch_intents set created_at = now() - interval '25 hours' where id = ${id}`;
  await sql`delete from watchlist where user_id = ${user.id} and csc = ${csc2}`;
  assert.equal((await applyWatchIntent(id, user)).status, "expired");
  assert.equal(await peekWatchIntent(id), null);
  const w = await sql`select 1 from watchlist where user_id = ${user.id} and csc = ${csc2}`;
  assert.equal(w.length, 0);
});

test("a full watchlist is reported, not overflowed", async () => {
  const fill = await sql<{ csc: string }[]>`select csc from products where csc <> ${csc2} order by csc offset 2 limit 50`;
  await sql`delete from watchlist where user_id = ${user.id}`;
  await sql`insert into watchlist (user_id, csc) select ${user.id}, unnest(${fill.map((f) => f.csc)}::text[])`;
  const id = (await createWatchIntent(EMAIL, csc2, null))!;
  assert.equal((await applyWatchIntent(id, user)).status, "full");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from watchlist where user_id = ${user.id}`;
  assert.equal(n, 50);
});

test("garbage ids are ignored", async () => {
  assert.equal((await applyWatchIntent("not-a-uuid", user)).status, "not_found");
  assert.equal((await applyWatchIntent("00000000-0000-0000-0000-000000000000", user)).status, "not_found");
});

test("replaying a used link after unwatching neither re-adds nor removes anything", async () => {
  await sql`delete from watchlist where user_id = ${user.id}`;
  const id = (await createWatchIntent(EMAIL, csc, null))!;
  assert.equal((await applyWatchIntent(id, user)).status, "added");
  await sql`delete from watchlist where user_id = ${user.id} and csc = ${csc}`; // unwatched on the site
  assert.equal((await applyWatchIntent(id, user)).status, "not_found");
  const w = await sql`select 1 from watchlist where user_id = ${user.id} and csc = ${csc}`;
  assert.equal(w.length, 0, "the old link doesn't bring the watch back");
});

test("attribution rides through confirmation: one watch_added, only for a new watch", async () => {
  await sql`delete from watchlist where user_id = ${user.id}`;
  await sql`delete from discover_events where user_id = ${user.id}`;
  const id = (await createWatchIntent(EMAIL, csc, null, { source: "product:page", visitorId: "visitor-test-123" }))!;
  assert.equal((await peekWatchIntent(id))?.source, "product:page");
  assert.equal((await applyWatchIntent(id, user)).status, "added");
  assert.equal((await applyWatchIntent(id, user)).status, "already");
  const ev = await sql<{ kind: string; surface: string; view: string; visitor_id: string }[]>`
    select kind, surface, view, visitor_id from discover_events where user_id = ${user.id}`;
  assert.deepEqual(ev.map((e) => ({ ...e })), [
    { kind: "watch_added", surface: "product", view: "page", visitor_id: "visitor-test-123" },
  ]);
});

test("search attribution is kept; unknown sources are dropped", async () => {
  const a = (await createWatchIntent(EMAIL, csc2, null, { source: "search:exact", visitorId: "visitor-test-123" }))!;
  assert.equal((await peekWatchIntent(a))?.source, "search:exact");
  const b = (await createWatchIntent(EMAIL, csc2, null, { source: "evil:thing", visitorId: "visitor-test-123" }))!;
  assert.equal((await peekWatchIntent(b))?.source, null);
});

test("+test accounts get the watch but no analytics event", async () => {
  const [t] = await sql<{ id: string; email: string }[]>`
    insert into auth.users (email) values ('watch-intent-test+test1@example.com') returning id, email`;
  const id = (await createWatchIntent(t.email, csc, null, { source: "product:page", visitorId: "visitor-test-456" }))!;
  assert.equal((await applyWatchIntent(id, t)).status, "added");
  const w = await sql`select 1 from watchlist where user_id = ${t.id} and csc = ${csc}`;
  assert.equal(w.length, 1);
  const ev = await sql`select 1 from discover_events where user_id = ${t.id}`;
  assert.equal(ev.length, 0);
});
