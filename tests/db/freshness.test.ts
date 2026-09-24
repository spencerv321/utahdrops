/**
 * Store-check scheduling, failure handling and alert events against a real
 * Postgres with the catalog loaded (see CLAUDE.md). Run: pnpm test:db.
 * Sends no email: without RESEND_API_KEY the digest only logs.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../../lib/db";
import {
  WATCH_SHARE,
  persistDetail,
  recordStoreFailure,
  selectStoreTargets,
} from "../../lib/jobs/store-inventory";
import { runDigestJob } from "../../lib/jobs/digest";
import type { ProductDetail } from "../../lib/dabs/detail";

const EMAIL = "freshness-test@example.com";
const STORE = 99991;
let user: { id: string };
let watchedCscs: string[];

const detail = (sku: string, qty: number): ProductDetail => ({
  sku,
  name: "TEST",
  statusRaw: null,
  warehouseQty: null,
  onOrderQty: null,
  price: null,
  description: null,
  stores: qty > 0 ? [{ storeId: STORE, storeName: "STORE 99991 TEST", address: null, city: "Testville", phone: null, qty, lat: null, lng: null }] : [],
});

before(async () => {
  await sql`delete from auth.users where email = ${EMAIL}`;
  [user] = await sql<{ id: string }[]>`insert into auth.users (email) values (${EMAIL}) returning id`;
  await sql`insert into stores (id, name, city) values (${STORE}, 'STORE 99991 TEST', 'Testville') on conflict (id) do nothing`;
  // Watch ten in-stock bottles that were all checked recently by the rotation.
  watchedCscs = (await sql<{ csc: string }[]>`select csc from products where in_stock order by csc limit 10`).map((r) => r.csc);
  await sql`insert into watchlist (user_id, csc, created_at)
            select ${user.id}, unnest(${watchedCscs}::text[]), now() - interval '10 days'`;
  await sql`insert into user_stores (user_id, store_id) values (${user.id}, ${STORE})`;
  await sql`update products set store_checked_at = now() - interval '1 day', store_retry_at = null, store_check_failures = 0
            where csc = any(${watchedCscs})`;
});

after(async () => {
  await sql`delete from alert_deliveries where user_id = ${user.id}`;
  await sql`delete from inventory_events where detail->>'test' = 'freshness'
            or (event_type = 'store_restock' and (detail->>'store_id')::int = ${STORE})`;
  await sql`delete from store_inventory where store_id = ${STORE}`;
  await sql`delete from store_inventory_current where store_id = ${STORE}`;
  await sql`delete from auth.users where email = ${EMAIL}`;
  await sql`delete from stores where id = ${STORE}`;
  await sql.end();
});

test("each run reserves a bounded slice for watched bottles and fills the rest by rotation", async () => {
  const { watched, rotation } = await selectStoreTargets(20);
  const anyWatched = (await sql<{ csc: string }[]>`select distinct csc from watchlist`).map((r) => r.csc);
  assert.equal(watched.length, Math.floor(20 * WATCH_SHARE));
  assert.ok(watched.every((c) => anyWatched.includes(c)), "the reserved slice only holds watched bottles");
  assert.equal(watched.length + rotation.length, 20);
  assert.ok(rotation.every((c) => !watched.includes(c)));
  // Rotation is the least recently checked in-stock products, not the watched ones.
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from products where csc = any(${rotation}) and in_stock`;
  assert.equal(n, rotation.length);
});

test("over several runs both watched and ordinary products keep progressing", async () => {
  const seen = new Set<string>();
  const ordinary = new Set<string>();
  const seenBefore = new Set<string>();
  for (let run = 0; run < 5; run++) {
    const { watched, rotation } = await selectStoreTargets(10);
    // Simulate a successful check of everything selected.
    const all = [...watched, ...rotation];
    await sql`update products set store_checked_at = now(), last_store_scrape = now() where csc = any(${all})`;
    watched.forEach((c) => seen.add(c));
    rotation.forEach((c) => ordinary.add(c));
    // Bottles checked this session aren't picked again before they're due.
    assert.ok(watched.every((c) => !seenBefore.has(c)));
    watched.forEach((c) => seenBefore.add(c));
  }
  assert.ok(watchedCscs.every((c) => seen.has(c)), "every watched bottle got checked");
  assert.ok(ordinary.size >= 30, `ordinary products advanced too (${ordinary.size})`);
  // …but come due again after WATCH_RECHECK_HOURS.
  await sql`update products set store_checked_at = now() - interval '5 hours' where csc = any(${watchedCscs})`;
  const due = (await selectStoreTargets(40)).watched;
  assert.ok(watchedCscs.every((c) => due.includes(c)));
});

test("a failed check keeps the last good observation and backs off", async () => {
  const csc = watchedCscs[0];
  const [before] = await sql<{ store_checked_at: Date }[]>`
    update products set store_checked_at = now() - interval '2 days' where csc = ${csc} returning store_checked_at`;
  await recordStoreFailure(csc);
  await recordStoreFailure(csc);
  const [after] = await sql<{ store_checked_at: Date; last_store_scrape: Date; store_check_failures: number; retry_hours: number }[]>`
    select store_checked_at, last_store_scrape, store_check_failures,
           extract(epoch from store_retry_at - now()) / 3600 as retry_hours
    from products where csc = ${csc}`;
  assert.equal(after.store_checked_at.getTime(), before.store_checked_at.getTime(), "success time untouched");
  assert.ok(Date.now() - after.last_store_scrape.getTime() < 60_000, "attempt recorded");
  assert.equal(after.store_check_failures, 2);
  assert.ok(after.retry_hours > 11 && after.retry_hours <= 12, `second failure waits 12h (${after.retry_hours})`);
  const { watched, rotation } = await selectStoreTargets(500);
  assert.ok(!watched.includes(csc) && !rotation.includes(csc), "not retried before its retry time");

  // A later success clears the backoff.
  await persistDetail(detail(csc, 0));
  const [ok] = await sql<{ store_check_failures: number; store_retry_at: Date | null; age: number }[]>`
    select store_check_failures, store_retry_at, extract(epoch from now() - store_checked_at) as age
    from products where csc = ${csc}`;
  assert.equal(ok.store_check_failures, 0);
  assert.equal(ok.store_retry_at, null);
  assert.ok(ok.age < 60);
});

test("store restocks need a recent zero; outage-era gaps emit nothing", async () => {
  const [fresh, stale] = watchedCscs.slice(1, 3);
  for (const csc of [fresh, stale]) {
    await sql`insert into store_inventory_current (csc, store_id, qty, scraped_at)
              values (${csc}, ${STORE}, 0, now() - interval '1 day')
              on conflict (csc, store_id) do update set qty = 0, scraped_at = excluded.scraped_at`;
  }
  await sql`update store_inventory_current set scraped_at = now() - interval '9 days' where csc = ${stale} and store_id = ${STORE}`;
  await persistDetail(detail(fresh, 4));
  await persistDetail(detail(stale, 4));
  const events = await sql<{ csc: string; detail: Record<string, unknown> }[]>`
    select csc, detail from inventory_events
    where event_type = 'store_restock' and (detail->>'store_id')::int = ${STORE}`;
  assert.deepEqual(events.map((e) => e.csc), [fresh]);
  assert.ok(events[0].detail.prev_checked_at, "records when we last saw none there");
});

test("digest skips superseded and stale events and never repeats a delivery", async () => {
  const [restocked, soldAgain, storeGone, old] = watchedCscs.slice(3, 7);
  const mk = (csc: string, type: string, ago: string) =>
    sql`insert into inventory_events (csc, event_type, detail, created_at)
        values (${csc}, ${type}, ${sql.json({ test: "freshness", qty: 12, scope: "statewide" })}, now() - ${ago}::interval)`;
  await sql`update products set in_stock = true where csc = any(${[restocked, soldAgain]})`;
  await mk(restocked, "restock", "2 hours");
  await mk(soldAgain, "restock", "3 hours");
  await mk(soldAgain, "out_of_stock", "1 hour");
  await mk(old, "restock", "3 days");
  // store restock at the home store whose latest check shows none again
  await sql`insert into inventory_events (csc, event_type, detail)
            values (${storeGone}, 'store_restock', ${sql.json({ store_id: STORE, store_name: "TEST", qty: 2 })})`;
  await sql`insert into store_inventory_current (csc, store_id, qty, scraped_at) values (${storeGone}, ${STORE}, 0, now())
            on conflict (csc, store_id) do update set qty = 0, scraped_at = now()`;

  await runDigestJob();
  const delivered = await sql<{ csc: string; event_type: string }[]>`
    select e.csc, e.event_type from alert_deliveries d join inventory_events e on e.id = d.event_id
    where d.user_id = ${user.id}`;
  const got = delivered.map((d) => `${d.csc}:${d.event_type}`).sort();
  assert.ok(got.includes(`${restocked}:restock`), "live restock sent");
  assert.ok(got.includes(`${soldAgain}:out_of_stock`) === false, "sell-out of a product now in stock is superseded");
  assert.ok(!got.includes(`${soldAgain}:restock`), "restock followed by a sell-out is not sent as 'back'");
  assert.ok(!got.includes(`${storeGone}:store_restock`), "store restock the latest check contradicts is not sent");
  assert.ok(!got.includes(`${old}:restock`), "events past the 48h window are history, not alerts");
  assert.ok(got.some((g) => g.startsWith(`${watchedCscs[1]}:store_restock`)), "fresh store restock at a home store sent");

  const before = delivered.length;
  await runDigestJob();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from alert_deliveries where user_id = ${user.id}`;
  assert.equal(n, before, "second run delivers nothing new");
});
