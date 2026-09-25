/**
 * "Worth a look" eligibility against a real Postgres (see CLAUDE.md for local
 * setup). Run: pnpm test:db. Uses synthetic products 9900xx, a test store far
 * outside Utah, and tagged catalog runs; cleans up after itself.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "../../lib/db";
import { clearDiscoverCache, getDiscoverCandidates } from "../../lib/discover";
import { nearState, rankView } from "../../lib/discover-rules";
import { recordStoreFailure } from "../../lib/jobs/store-inventory";
import { applyWatchIntent, createWatchIntent } from "../../lib/watch-intent";

const STORE = 99981;
const AREA = { label: "Testville", lat: 45, lng: -100 };
const EMAIL = "discover-test@example.com";
const TEST_MONTH = "1999-01-01";
const ago = (days: number) => sql`now() - make_interval(secs => ${Math.round(days * 86400)})`;

async function product(csc: string, o: { price?: number; qty?: number; lastSeenDays?: number; status?: string } = {}) {
  const qty = o.qty ?? 12;
  await sql`
    insert into products (csc, name, category, size_ml, status, current_price, store_qty, in_stock, last_seen)
    values (${csc}, ${"DISCOVER TEST " + csc + " 750ml"}, 'WHISKEY - BOURBON & TENNESSEE', 750, ${o.status ?? "1"},
            ${o.price ?? 50}, ${qty}, ${qty > 0}, ${ago(o.lastSeenDays ?? 0.1)})`;
}
async function rarity(csc: string, tier: string, published = true) {
  await sql`
    insert into product_rarity (csc, tier, published, label, headline, explanation, evidence, method)
    values (${csc}, ${tier}, ${published}, 'test', ${"Headline " + tier}, 'test', '[]'::jsonb, 'test')`;
}
async function snapshot(csc: string, daysAgo: number, qty: number, price = 50) {
  await sql`insert into inventory_snapshots (csc, scraped_at, store_qty, price) values (${csc}, ${ago(daysAgo)}, ${qty}, ${price})`;
}
async function priceChange(csc: string, daysAgo: number, from: number, to: number) {
  await sql`
    insert into inventory_events (csc, event_type, detail, created_at)
    values (${csc}, 'price_change', ${sql.json({ old: from, new: to, test: "discover" })}, ${ago(daysAgo)})`;
}
const cscs = async (view: "scarce" | "back" | "price", area: typeof AREA | null = null) =>
  (clearDiscoverCache(), await getDiscoverCandidates(view, area)).map((i) => i.csc).filter((c) => c.startsWith("9900")).sort();

async function cleanup() {
  await sql`delete from discover_events where csc like '9900%'`;
  await sql`delete from watch_intents where email = ${EMAIL}`;
  await sql`delete from auth.users where email = ${EMAIL}`;
  await sql`delete from inventory_events where csc like '9900%'`;
  await sql`delete from inventory_snapshots where csc like '9900%'`;
  await sql`delete from store_inventory_current where csc like '9900%'`;
  await sql`delete from store_inventory where csc like '9900%'`;
  await sql`delete from product_rarity where csc like '9900%'`;
  await sql`delete from rarity_overrides where csc like '9900%'`;
  await sql`delete from rhdp_drawings where item_code like '9900%'`;
  await sql`delete from allocated_drops where product_name like 'DISCOVER TEST%'`;
  await sql`delete from sales_reports where period_month = ${TEST_MONTH}`;
  await sql`delete from scrape_runs where job = 'catalog' and detail->>'test' = 'discover'`;
  await sql`delete from products where csc like '9900%'`;
  await sql`delete from stores where id = ${STORE}`;
}

before(async () => {
  await cleanup();
  await sql`insert into stores (id, name, city, lat, lng) values (${STORE}, 'STORE 99981 TEST', 'Testville', 45.01, -100.01)`;
  // Catalog passes every 8 hours for the last 100 days (tagged for cleanup).
  await sql`
    insert into scrape_runs (job, started_at, finished_at, ok, detail)
    select 'catalog', now() - g * interval '8 hours', now() - g * interval '8 hours' + interval '2 minutes', true,
           '{"test":"discover"}'::jsonb
    from generate_series(1, 300) g`;

  // ── scarce ──
  await product("990001"); await rarity("990001", "scarce"); // in stock, rated: shown
  await product("990002", { qty: 0 }); await rarity("990002", "rare"); // out of stock
  await product("990003", { lastSeenDays: 3 }); await rarity("990003", "rare"); // stale statewide
  await product("990004"); await rarity("990004", "everyday"); // override raises it to Rare
  await sql`insert into rarity_overrides (csc, tier, note, reviewed_on) values ('990004', 'rare', 'test', current_date)`;
  await product("990005"); await rarity("990005", "rare"); // override hides the badge
  await sql`insert into rarity_overrides (csc, tier, note, reviewed_on) values ('990005', null, 'test', current_date)`;
  await product("990006"); await rarity("990006", "unicorn"); // released by drawing
  await sql`insert into rhdp_drawings (drawing, item_code, product_name, bottles, section)
            values ('TEST DRAWING', '990006', 'DISCOVER TEST 990006', 10, 'past')`;
  // Listed in an allocated drop with bottles, but DABS shows none in stores now.
  await product("990007", { qty: 0 }); await rarity("990007", "scarce");
  await sql`insert into allocated_drops (drop_date, csc, product_name, bottle_qty, store_text)
            values (current_date - 3, '990007', 'DISCOVER TEST 990007 750ml', 50, 'TEST')`;
  await product("990008"); await rarity("990008", "rare", false); // computed but not published
  await product("990009", { status: "S" }); await rarity("990009", "rare"); // special order

  // Nearby: 990001 fresh positive nearby; 990004 only a 30h-old positive; 990008 n/a.
  await sql`update products set store_checked_at = now() - interval '2 hours' where csc = '990001'`;
  await sql`insert into store_inventory_current (csc, store_id, qty, scraped_at)
            values ('990001', ${STORE}, 3, now() - interval '2 hours'),
                   ('990004', ${STORE}, 5, now() - interval '30 hours')`;
  await sql`update products set store_checked_at = now() - interval '30 hours' where csc = '990004'`;

  // ── back after a while ──
  await product("990010"); // in stock → out 44 days → back yesterday
  await snapshot("990010", 80, 5); await snapshot("990010", 45, 0); await snapshot("990010", 1, 7);
  await product("990011"); // first seen at zero, never in stock before: not a return
  await snapshot("990011", 45, 0); await snapshot("990011", 1, 7);
  await product("990012"); // out only 19 days
  await snapshot("990012", 80, 5); await snapshot("990012", 20, 0); await snapshot("990012", 1, 7);
  await product("990013"); // long absence, but back 20 days ago (not recent)
  await snapshot("990013", 90, 5); await snapshot("990013", 60, 0); await snapshot("990013", 20, 7);
  await product("990014"); // out 75 days, back 5 days ago; a checks outage falls inside (see below)
  await snapshot("990014", 95, 5); await snapshot("990014", 80, 0); await snapshot("990014", 5, 7);

  // ── price drops ──
  await product("990020", { price: 40 }); await priceChange("990020", 3, 50, 40); // 20%, $10: shown
  await product("990021", { price: 50 }); await priceChange("990021", 3, 40, 50); // increase
  await product("990022", { price: 22.5 }); await priceChange("990022", 3, 25, 22.5); // 10% but $2.50
  await product("990023", { price: 50 }); await priceChange("990023", 20, 50, 40); await priceChange("990023", 2, 40, 50); // reversed
  await product("990024", { price: 45 }); await priceChange("990024", 3, 50, 40); // current price no longer supports it
  await product("990025", { price: 40 }); await priceChange("990025", 3, 50, 40); // reused code (two vintages)
  await sql`insert into sales_reports (period_month, fiscal_label, source_url, file_sha256, lines, item_codes, reused_codes, sum_dollars, sum_bottles)
            values (${TEST_MONTH}, 'TEST', 'test', 'test', 2, 1, 1, 0, 0)`;
  await sql`insert into monthly_sales (period_month, line, item_code, item_name, raw) values
            (${TEST_MONTH}, 990001, '990025', 'TEST CABERNET 2019', '{}'::jsonb),
            (${TEST_MONTH}, 990002, '990025', 'TEST CABERNET 2021', '{}'::jsonb)`;
  await product("990026", { price: 40 }); await priceChange("990026", 4, 40, 55); await priceChange("990026", 3, 55, 40); // one-pass spike
  await product("990027", { price: 40 }); await priceChange("990027", 45, 50, 40); // too old
  await product("990028", { price: 12 }); await priceChange("990028", 5, 16, 12); // cheap bottle, 25%, $4: shown
});

after(async () => {
  await cleanup();
  await sql.end();
});

test("scarce: only in-stock, fresh, retail, published-or-overridden Scarce+ bottles", async () => {
  assert.deepEqual(await cscs("scarce"), ["990001", "990004"]);
  const items = await getDiscoverCandidates("scarce", null);
  assert.equal(items.find((i) => i.csc === "990004")?.tier, "rare", "the manual override wins");
});

test("historical allocated-drop quantities are not stock", async () => {
  assert.ok(!(await cscs("scarce")).includes("990007"));
  assert.ok(!(await cscs("price")).includes("990007"));
});

test("nearby needs a fresh positive local observation; failed checks don't renew it", async () => {
  const items = await getDiscoverCandidates("scarce", AREA);
  const one = items.find((i) => i.csc === "990001")!;
  const four = items.find((i) => i.csc === "990004")!;
  assert.equal(nearState(one, true).kind, "near");
  assert.equal(nearState(four, true).kind, "unknown", "30h-old positive stock is not a nearby claim");
  // A failed attempt records the attempt but must not make the old count look fresh.
  await recordStoreFailure("990004");
  const again = (await getDiscoverCandidates("scarce", AREA)).find((i) => i.csc === "990004")!;
  assert.equal(nearState(again, true).kind, "unknown");
  assert.deepEqual(rankView(items, "scarce", { hasArea: true, nearbyOnly: true }).filter((i) => i.csc.startsWith("9900")).map((i) => i.csc), ["990001"]);
});

test("unknown nearby coverage is not 'none nearby'", async () => {
  // Never store-checked: unknown.
  await sql`update products set store_checked_at = null where csc = '990004'`;
  let four = (await getDiscoverCandidates("scarce", AREA)).find((i) => i.csc === "990004")!;
  assert.equal(nearState(four, true).kind, "unknown");
  // Fully checked 3h ago with nothing nearby: that's a real "none near".
  await sql`delete from store_inventory_current where csc = '990004'`;
  await sql`update products set store_checked_at = now() - interval '3 hours' where csc = '990004'`;
  four = (await getDiscoverCandidates("scarce", AREA)).find((i) => i.csc === "990004")!;
  assert.equal(nearState(four, true).kind, "not-near");
});

test("back after a while: observed absence ≥ 30 days, returned recently, previously in stock", async () => {
  assert.deepEqual(await cscs("back"), ["990010", "990014"]);
  const item = (await getDiscoverCandidates("back", null)).find((i) => i.csc === "990010")!;
  assert.ok(item.outSince && item.backAt && item.backAt.getTime() - item.outSince.getTime() >= 30 * 86400_000);
});

test("an outage inside the absence is not a confirmed absence", async () => {
  // Three days without catalog passes inside 990014's absence only.
  await sql`delete from scrape_runs where job = 'catalog' and detail->>'test' = 'discover'
            and started_at between now() - interval '62 days' and now() - interval '59 days'`;
  assert.deepEqual(await cscs("back"), ["990010"]);
  // …and one inside 990010's absence too.
  await sql`delete from scrape_runs where job = 'catalog' and detail->>'test' = 'discover'
            and started_at between now() - interval '25 days' and now() - interval '22 days'`;
  assert.deepEqual(await cscs("back"), []);
});

test("price drops: real, still current, same code, stable previous price", async () => {
  assert.deepEqual(await cscs("price"), ["990020", "990028"]);
  const item = (await getDiscoverCandidates("price", null)).find((i) => i.csc === "990020")!;
  assert.equal(item.oldPrice, 50);
  assert.equal(item.price, 40);
});

test("a pending watch from discovery is attributed once, after verification", async () => {
  const [user] = await sql<{ id: string; email: string }[]>`insert into auth.users (email) values (${EMAIL}) returning id, email`;
  const id = await createWatchIntent(EMAIL, "990001", null, { source: "discover:scarce", visitorId: "visitor-test-1" });
  assert.ok(id);
  // Nothing counted before the link is used.
  const before = await sql`select 1 from discover_events where csc = '990001' and kind = 'watch_added'`;
  assert.equal(before.length, 0);
  assert.equal((await applyWatchIntent(id!, user)).status, "added");
  // Re-opening the link changes nothing and isn't counted twice.
  assert.equal((await applyWatchIntent(id!, user)).status, "already");
  const rows = await sql<{ surface: string; view: string; visitor_id: string; user_id: string }[]>`
    select surface, view, visitor_id, user_id from discover_events where csc = '990001' and kind = 'watch_added'`;
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ surface: "discover", view: "scarce", visitor_id: "visitor-test-1", user_id: user.id }]);

  // A bogus source is ignored; an unattributed watch records nothing.
  const plain = await createWatchIntent(EMAIL, "990004", null, { source: "evil:<script>" });
  assert.equal((await applyWatchIntent(plain!, user)).status, "added");
  const none = await sql`select 1 from discover_events where csc = '990004'`;
  assert.equal(none.length, 0);
  await sql`delete from watchlist where user_id = ${user.id}`;
});
