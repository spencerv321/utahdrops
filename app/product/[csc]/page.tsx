import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProduct,
  getProductEvents,
  getProductHistory,
  getProductRarity,
  getStoreAvailability,
  getUserStoreIds,
  getWatchedSet,
  type EventRow,
  type SnapshotPoint,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { StockChart } from "@/components/stock-chart";
import { WatchButton } from "@/components/watch-button";
import { ShareButton } from "@/components/share-button";
import { StoreAvailability, type HomeStore } from "@/components/store-availability";
import { RarityCard } from "@/components/rarity-card";
import {
  categoryLabel,
  checkedAgo,
  displayName,
  formatAsOf,
  formatPrice,
  formatQty,
  listingNote,
  productKind,
  productTitle,
  sizeLabel,
  storeLabel,
  unitWord,
  whenLabel,
} from "@/lib/format";
import { BottleGlyph } from "@/components/bottle-glyph";
import { Check } from "lucide-react";
import { DABS_LOCATOR_URL, SITE_URL, STATUS_LABELS, WATCH_REFRESH_NOTE, isFreshStoreCheck } from "@/lib/config";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ csc: string }>;
  searchParams: Promise<{ watch?: string; store?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { csc } = await params;
  const product = await getProduct(csc);
  if (!product) return { title: "Not found" };
  return {
    title: `${productTitle(product.name, product.size_ml)} ${sizeLabel(product.size_ml)} — price & where to find it`,
    description: `Price, stock at Utah state liquor stores, and price history for ${productTitle(product.name, product.size_ml)} ${sizeLabel(product.size_ml)} (DABS ${csc}).`,
    alternates: { canonical: `/product/${csc}` },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { csc } = await params;
  const { watch: watchResult, store: storeResult } = await searchParams;
  const [product, history, stores, events, user, rarity] = await Promise.all([
    getProduct(csc),
    getProductHistory(csc),
    getStoreAvailability(csc),
    getProductEvents(csc),
    getCurrentUser(),
    getProductRarity(csc),
  ]);
  if (!product) notFound();

  const [watchedSet, homeIds, watchEmailOn] = await Promise.all([
    getWatchedSet(user?.id, [csc]),
    getUserStoreIds(user?.id),
    user
      ? (sql`select watchlist_email from alert_prefs where user_id = ${user.id}` as unknown as Promise<
          { watchlist_email: boolean }[]
        >).then((r) => r[0]?.watchlist_email ?? true)
      : Promise.resolve(true),
  ]);
  const homeStores =
    homeIds.length > 0
      ? ((await sql`select id, name, city from stores where id = any(${homeIds})`) as unknown as HomeStore[])
      : [];

  const name = productTitle(product.name, product.size_ml);
  const unit = { one: unitWord(product.category, product.size_ml, 1), many: unitWord(product.category, product.size_ml, 2) };
  const storeAsOf = stores.reduce<Date | null>(
    (latest, s) => (!latest || s.scraped_at > latest ? s.scraped_at : latest),
    null
  );
  // Store-by-store checks older than a week aren't shown as current anywhere.
  const storesFresh = isFreshStoreCheck(storeAsOf);
  const storesWithStock = storesFresh ? stores.filter((s) => s.qty > 0).length : 0;
  const note = listingNote(product.status);
  // Bottles DABS releases by drawing aren't "gone for good" when unlisted.
  const drawingRelease = !!rarity?.evidence.some((e) => e.startsWith("DABS drawing"));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayName(product.name),
    sku: product.csc,
    category: product.category ?? undefined,
    description: product.description ?? undefined,
    url: `${SITE_URL}/product/${product.csc}`,
    ...(product.current_price
      ? {
          offers: {
            "@type": "Offer",
            price: Number(product.current_price).toFixed(2),
            priceCurrency: "USD",
            availability: product.in_stock
              ? "https://schema.org/InStock"
              : product.delisted_at
                ? "https://schema.org/Discontinued"
                : "https://schema.org/OutOfStock",
            seller: { "@type": "Organization", name: "Utah DABS" },
          },
        }
      : {}),
  };

  return (
    <div className="space-y-10 pt-2 sm:pt-6">
      {user && watchResult ? (
        <WatchConfirmation
          result={watchResult}
          storeResult={storeResult}
          name={name}
          watching={watchedSet.has(csc)}
          email={user.email ?? null}
          homeStores={homeStores}
          emailsOn={watchEmailOn}
        />
      ) : null}
      <script
        type="application/ld+json"
        // Escape "<" so product text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
        {/* Is this the right bottle? */}
        <header className="flex gap-4">
          <BottleGlyph kind={productKind(product.category, product.size_ml)} className="h-24 w-[4.5rem] sm:h-32 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-2">
            {product.category ? (
              <Link prefetch={false}
                href={`/search?category=${encodeURIComponent(product.category)}&instock=1`}
                className="kicker inline-block text-muted-foreground hover:text-foreground"
              >
                {categoryLabel(product.category)}
              </Link>
            ) : null}
            <h1 className="font-sans text-[1.75rem] leading-tight font-medium tracking-[-0.015em] sm:text-4xl">{name}</h1>
            <p className="text-[15px] text-muted-foreground">
              {[sizeLabel(product.size_ml), note].filter(Boolean).join(" · ")}
            </p>
            {product.description ? (
              <p className="max-w-prose pt-1 text-[15px] leading-relaxed text-muted-foreground">{product.description}</p>
            ) : null}
          </div>
          <ShareButton
            title={name}
            className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
          />
        </header>

        {/* What does it cost, is it anywhere, and how do I hear when it changes? */}
        <section aria-label="Price and availability" className="space-y-4 rounded-lg bg-card p-4 sm:p-5 lg:self-start">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-3xl font-medium tabular-nums">{formatPrice(product.current_price)}</p>
            {product.is_spa ? <span className="text-sm font-medium text-price-drop">On sale</span> : null}
          </div>
          <p className="-mt-2 text-sm text-muted-foreground">{priceNote(history)}</p>
          <p className="text-[15px]">
            {product.in_stock ? (
              <span className="inline-flex items-start gap-1.5 font-medium text-success">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  In stores: {formatQty(product.store_qty)} {unit.many} statewide
                  {storesWithStock > 0 && storeAsOf
                    ? ` (at least ${storesWithStock} stores, checked ${checkedAgo(storeAsOf)})`
                    : ""}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Not in stores right now.</span>
            )}
          </p>
          {product.delisted_at ? (
            drawingRelease ? (
              <p className="text-sm text-warning">Not currently listed. DABS has released it through drawings.</p>
            ) : (
              <p className="text-sm text-warning">DABS no longer lists this product, so it may not come back.</p>
            )
          ) : null}
          <div className="space-y-2 border-t pt-4">
            <WatchButton csc={csc} initialWatched={watchedSet.has(csc)} signedIn={!!user} />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {watchedSet.has(csc)
                ? `We'll email you when DABS shows it back in stores anywhere in Utah${
                    homeStores.length > 0
                      ? `, or back at ${homeStores.map((h) => storeLabel(h.name, h.city).title).join(", ")}`
                      : ""
                  }, and if it sells out or changes price. `
                : "Get an email when it's back in stores, sells out, or changes price. "}
              {WATCH_REFRESH_NOTE}
            </p>
          </div>
          <p className="text-xs text-subtle-foreground">
            {product.delisted_at && drawingRelease
              ? "Price from its most recent DABS drawing."
              : `Price and statewide count from DABS ${whenLabel(product.last_seen)}.`}
          </p>
        </section>
      </div>

      {rarity ? <RarityCard csc={csc} rarity={rarity} /> : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
        <section className="space-y-4" aria-labelledby="where-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="where-title" className="font-display text-[2rem] leading-none sm:text-4xl">
              Where to find it
            </h2>
            {storeAsOf && storesFresh ? (
              <span className="text-[13px] text-muted-foreground">Store counts from {whenLabel(storeAsOf)}</span>
            ) : null}
          </div>
          {stores.length === 0 ? (
            <div className="space-y-2 border-y py-5 text-[15px]">
              <p>We don&apos;t have store-by-store counts for this bottle yet.</p>
              <p className="text-muted-foreground">
                {product.in_stock
                  ? `DABS shows ${formatQty(product.store_qty)} ${unit.many} in stores statewide. `
                  : "DABS shows none in stores right now. "}
                The{" "}
                <a className="text-foreground underline underline-offset-4" href={DABS_LOCATOR_URL} rel="noopener">
                  official locator
                </a>{" "}
                lists stores by name.
              </p>
            </div>
          ) : !storesFresh ? (
            <div className="space-y-3 border-y py-5 text-[15px]">
              <p>
                Store-by-store counts were last checked {whenLabel(storeAsOf)}, too long ago to rely on. We&apos;ll
                refresh them soon.
              </p>
              <p className="text-muted-foreground">
                {product.in_stock
                  ? `Right now DABS shows ${formatQty(product.store_qty)} ${unit.many} in stores statewide. `
                  : "Right now DABS shows none in stores. "}
                The{" "}
                <a className="text-foreground underline underline-offset-4" href={DABS_LOCATOR_URL} rel="noopener">
                  official locator
                </a>{" "}
                lists stores by name.
              </p>
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Show last known stores ({whenLabel(storeAsOf)})
                </summary>
                <div className="pt-3 opacity-70">
                  <StoreAvailability
                    unit={unit}
                    homeStores={homeStores}
                    stores={stores.map((s) => ({
                      store_id: s.store_id,
                      name: s.name,
                      address: s.address,
                      city: s.city,
                      phone: s.phone,
                      lat: s.lat,
                      lng: s.lng,
                      qty: s.qty,
                    }))}
                  />
                </div>
              </details>
            </div>
          ) : (
            <StoreAvailability
              unit={unit}
              homeStores={homeStores}
              stores={stores.map((s) => ({
                store_id: s.store_id,
                name: s.name,
                address: s.address,
                city: s.city,
                phone: s.phone,
                lat: s.lat,
                lng: s.lng,
                qty: s.qty,
              }))}
            />
          )}
          {!user ? (
            <p className="text-sm text-muted-foreground">
              <Link prefetch={false} href={`/login?next=/product/${csc}`} className="text-foreground underline underline-offset-4">
                Sign in
              </Link>{" "}
              and pick your store to see it listed first.
            </p>
          ) : homeStores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Link prefetch={false} href="/watchlist" className="text-foreground underline underline-offset-4">
                Pick your store
              </Link>{" "}
              to see it listed first and get &ldquo;back at my store&rdquo; emails.
            </p>
          ) : null}
        </section>

        <div className="space-y-10">
          <section className="space-y-3" aria-labelledby="history-title">
            <h2 id="history-title" className="font-display text-[2rem] leading-none sm:text-4xl">
              Last 90 days
            </h2>
            <p className="text-sm text-muted-foreground">{unit.many.replace(/^./, (c) => c.toUpperCase())} in stores statewide.</p>
            {history.length >= 2 ? (
              <StockChart
                points={history.map((p) => ({ t: new Date(p.scraped_at).getTime(), v: p.store_qty ?? 0 }))}
                until={new Date(product.last_seen).getTime()}
              />
            ) : (
              <p className="border-y py-5 text-sm text-muted-foreground">The chart fills in after a few days of tracking.</p>
            )}
          </section>

          {events.length > 0 ? (
            <section className="space-y-3" aria-labelledby="changes-title">
              <h2 id="changes-title" className="font-display text-[2rem] leading-none sm:text-4xl">
                What changed
              </h2>
              <ol className="divide-y border-y">
                {events.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-4 py-2.5">
                    <span className="w-14 shrink-0 text-[13px] text-subtle-foreground tabular-nums">
                      {new Date(e.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "America/Denver",
                      })}
                    </span>
                    <span className="text-[15px]">{eventText(e, unit.many)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <details className="group border-y">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px]">
              DABS listing details
              <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 pb-4 text-sm">
              <Detail term="Name at DABS">{product.name}</Detail>
              <Detail term="DABS code">{product.csc}</Detail>
              <Detail term="Listing status">
                {product.status ? `${STATUS_LABELS[product.status] ?? product.status}` : "—"}
                <span className="block text-xs text-subtle-foreground">How DABS carries it, not whether it&apos;s on a shelf.</span>
              </Detail>
              <Detail term="In stores">{formatQty(product.store_qty)}</Detail>
              <Detail term="At the DABS warehouse">
                {formatQty(product.warehouse_qty)}
                <span className="block text-xs text-subtle-foreground">Not for sale there; stock waiting to ship to stores.</span>
              </Detail>
              <Detail term="On order">{formatQty(product.on_order_qty)}</Detail>
              <Detail term="DABS category">{product.category ?? "—"}</Detail>
              <Detail term="Last in the catalog">{formatAsOf(product.last_seen)} MT</Detail>
            </dl>
          </details>
        </div>
      </div>

      <p className="text-xs text-subtle-foreground">
        Counts come from public DABS pages and can lag. Call ahead, or check the{" "}
        <a className="underline underline-offset-4" href={DABS_LOCATOR_URL} rel="noopener">
          official DABS locator
        </a>
        , before you drive.
      </p>
    </div>
  );
}

/**
 * After a "watch this bottle" sign-in (app/watch/confirm): what was set up, in
 * plain words. Success is shown only when the watch really exists.
 */
function WatchConfirmation({
  result,
  storeResult,
  name,
  watching,
  email,
  homeStores,
  emailsOn,
}: {
  result: string;
  storeResult?: string;
  name: string;
  watching: boolean;
  email: string | null;
  homeStores: HomeStore[];
  emailsOn: boolean;
}) {
  const stores = homeStores.map((s) => storeLabel(s.name, s.city).title);
  const storeText =
    stores.length === 0 ? "" : stores.length === 1 ? stores[0] : `${stores.slice(0, -1).join(", ")} or ${stores[stores.length - 1]}`;
  const box = "space-y-1.5 rounded-lg border px-4 py-3.5 text-[15px] leading-relaxed";

  if ((result === "added" || result === "already") && watching) {
    return (
      <div role="status" className={`${box} border-success/40`}>
        <p className="font-medium text-success">You&apos;re watching {name}.</p>
        <p>
          We&apos;ll email {email ?? "you"} when DABS shows it back in stores anywhere in Utah
          {storeText ? `, and when it's back at ${storeText}` : ""}.
        </p>
        {storeResult === "full" ? (
          <p className="text-muted-foreground">
            You already have 3 stores, so we didn&apos;t add another.{" "}
            <Link prefetch={false} href="/watchlist" className="text-foreground underline underline-offset-4">
              Change your stores
            </Link>
          </p>
        ) : null}
        {!emailsOn ? (
          <p className="text-warning">
            Watchlist emails are turned off for your account.{" "}
            <Link prefetch={false} href="/watchlist" className="underline underline-offset-4">
              Turn them on
            </Link>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/watchlist" className="underline underline-offset-4">
            Manage your watchlist
          </Link>
        </p>
      </div>
    );
  }

  const why =
    result === "full"
      ? "your watchlist is full (50 bottles). Remove one on your watchlist, then tap Watch this bottle."
      : result === "expired"
        ? "that watch request is more than a day old. Tap Watch this bottle below to add it now."
        : result === "mismatch"
          ? `this watch was requested for a different email than ${email ?? "this account"}. Tap Watch this bottle below to add it here.`
          : "we couldn't add the watch. Tap Watch this bottle below to try again.";
  return (
    <div role="alert" className={`${box} border-warning/50`}>
      <p className="font-medium">You&apos;re signed in, but {why}</p>
    </div>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="tabular-nums">{children}</dd>
    </>
  );
}

/** One line on price history: stable, or what it was before the last change. */
function priceNote(history: SnapshotPoint[]): string {
  const prices = history.filter((p) => p.price != null);
  if (prices.length === 0) return "";
  const current = Number(prices[prices.length - 1].price);
  for (let i = prices.length - 2; i >= 0; i--) {
    const was = Number(prices[i].price);
    if (was !== current) {
      const when = new Date(prices[i + 1].scraped_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Denver",
      });
      return `${was > current ? "Down" : "Up"} from ${formatPrice(was)} on ${when}`;
    }
  }
  return "Same price for the last 90 days";
}

function eventText(e: EventRow, units: string): string {
  const d = e.detail;
  switch (e.event_type) {
    case "restock":
      return `Back in stores: ${formatQty(Number(d.qty))} ${units} statewide`;
    case "out_of_stock":
      return "Sold out statewide";
    case "new_product":
      return `Added to the DABS catalog at ${formatPrice(d.price as number)}`;
    case "price_change":
      return `Price ${formatPrice(d.old as number)} → ${formatPrice(d.new as number)}`;
    case "status_change":
      return `Status: ${STATUS_LABELS[String(d.old)] ?? d.old} → ${STATUS_LABELS[String(d.new)] ?? d.new}`;
    default:
      return e.event_type;
  }
}
