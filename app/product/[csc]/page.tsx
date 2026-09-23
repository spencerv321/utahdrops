import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProduct,
  getProductEvents,
  getProductHistory,
  getStoreAvailability,
  getUserStoreIds,
  getWatchedSet,
  type EventRow,
  type SnapshotPoint,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { StockChart } from "@/components/stock-chart";
import { WatchButton } from "@/components/watch-button";
import { ShareButton } from "@/components/share-button";
import { StoreAvailability, type HomeStore } from "@/components/store-availability";
import { EventTag, eventTagKey } from "@/components/event-tag";
import { displayName, formatAsOf, formatPrice, formatQty, formatSize } from "@/lib/format";
import { DABS_LOCATOR_URL, SITE_URL, STATUS_LABELS } from "@/lib/config";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ csc: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { csc } = await params;
  const product = await getProduct(csc);
  if (!product) return { title: "Not found" };
  return {
    title: `${displayName(product.name)} — price & availability`,
    description: `Current Utah DABS availability, price history, and per-store quantities for ${displayName(product.name)} (${csc}).`,
    alternates: { canonical: `/product/${csc}` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { csc } = await params;
  const supabase = await createClient();
  const [product, history, stores, events, { data: { user } }] = await Promise.all([
    getProduct(csc),
    getProductHistory(csc),
    getStoreAvailability(csc),
    getProductEvents(csc),
    supabase.auth.getUser(),
  ]);
  if (!product) notFound();

  const [watchedSet, homeIds] = await Promise.all([getWatchedSet(user?.id, [csc]), getUserStoreIds(user?.id)]);
  const homeStores =
    homeIds.length > 0
      ? ((await sql`select id, name, city from stores where id = any(${homeIds})`) as unknown as HomeStore[])
      : [];

  const name = displayName(product.name);
  const storeAsOf = stores.reduce<Date | null>(
    (latest, s) => (!latest || s.scraped_at > latest ? s.scraped_at : latest),
    null
  );
  const storesWithStock = stores.filter((s) => s.qty > 0).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
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
    <div className="space-y-8">
      <script
        type="application/ld+json"
        // Escape "<" so product text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Hero: what it is, what it costs, and the one action that matters. */}
      <section className="-mx-4 -mt-6 space-y-4 bg-brand px-4 pt-5 pb-6 text-brand-foreground sm:mx-0 sm:mt-0 sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-brand-muted">
            {product.status ? (
              <span className="rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-extrabold tracking-[0.06em] text-gold-foreground uppercase">
                {STATUS_LABELS[product.status] ?? product.status}
              </span>
            ) : null}
            <span>
              {[product.category && displayName(product.category), formatSize(product.size_ml), `#${product.csc}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <ShareButton
            title={name}
            className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-brand-raised"
          />
        </div>
        <h1 className="text-4xl leading-none sm:text-5xl">{name}</h1>
        {product.description ? (
          <p className="max-w-2xl text-[15px] text-brand-muted">{product.description}</p>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="font-display text-4xl font-extrabold text-gold tabular-nums">
            {formatPrice(product.current_price)}
            {product.is_spa ? (
              <span className="ml-2 align-middle text-sm font-bold text-brand-foreground">On sale</span>
            ) : null}
          </p>
          <p className="text-sm text-brand-muted">{priceNote(history)}</p>
        </div>
        {product.delisted_at ? (
          <p className="rounded-xl bg-brand-raised px-3 py-2 text-sm">
            DABS no longer lists this product. It may not come back.
          </p>
        ) : null}
        <WatchButton csc={csc} initialWatched={watchedSet.has(csc)} signedIn={!!user} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <section className="space-y-3" aria-labelledby="where-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="where-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
              Where to find it
            </h2>
            {storeAsOf ? (
              <span className="text-xs text-muted-foreground">counted {formatAsOf(storeAsOf)} MT</span>
            ) : null}
          </div>
          {stores.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-[15px] text-muted-foreground">
              We haven&apos;t collected store-by-store counts for this bottle yet.{" "}
              {product.in_stock
                ? `DABS shows ${formatQty(product.store_qty)} in stores statewide.`
                : "DABS shows none in stores right now."}{" "}
              Check the{" "}
              <a className="font-semibold text-primary underline" href={DABS_LOCATOR_URL} rel="noopener">
                official locator
              </a>{" "}
              for which stores.
            </div>
          ) : (
            <StoreAvailability
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
              <Link href={`/login?next=/product/${csc}`} className="font-semibold text-primary underline">
                Sign in
              </Link>{" "}
              and pick your store to see it here first.
            </p>
          ) : homeStores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/watchlist" className="font-semibold text-primary underline">
                Pick your store
              </Link>{" "}
              to see it here first and get &ldquo;back at my store&rdquo; alerts.
            </p>
          ) : null}
        </section>

        <div className="space-y-8">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={formatQty(product.store_qty)} label="bottles in stores" hint={stores.length ? `at ${storesWithStock} stores` : undefined} />
            <Stat value={formatQty(product.warehouse_qty)} label="at warehouse" />
            <Stat value={formatQty(product.on_order_qty)} label="on order" good={(product.on_order_qty ?? 0) > 0} />
          </div>

          <section className="space-y-3" aria-labelledby="history-title">
            <h2 id="history-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
              Bottles in stores, last 90 days
            </h2>
            {history.length >= 2 ? (
              <StockChart
                points={history.map((p) => ({ t: new Date(p.scraped_at).getTime(), v: p.store_qty ?? 0 }))}
                until={new Date(product.last_seen).getTime()}
              />
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                The chart fills in after a few days of tracking.
              </p>
            )}
          </section>

          {events.length > 0 ? (
            <section className="space-y-3" aria-labelledby="changes-title">
              <h2 id="changes-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                What changed
              </h2>
              <ol className="space-y-0">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex w-3 flex-col items-center" aria-hidden>
                      <span className="mt-1.5 size-3 rounded-full bg-primary" />
                      <span className="w-0.5 flex-1 bg-border" />
                    </div>
                    <div className="space-y-1 pb-5">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
                        {new Date(e.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/Denver",
                        })}
                        <EventTag tag={eventTagKey(e.event_type, e.detail)} />
                      </p>
                      <p className="font-semibold">{eventText(e)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Counts come from public DABS pages and can lag. Call ahead or check the{" "}
        <a className="underline" href={DABS_LOCATOR_URL} rel="noopener">
          official DABS locator
        </a>{" "}
        before driving. Last seen in the catalog {formatAsOf(product.last_seen)} MT.
      </p>
    </div>
  );
}

function Stat({ value, label, hint, good }: { value: string; label: string; hint?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className={`font-display text-2xl font-extrabold tabular-nums ${good ? "text-success" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
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

function eventText(e: EventRow): string {
  const d = e.detail;
  switch (e.event_type) {
    case "restock":
      return `Back in stores · ${formatQty(Number(d.qty))} bottles statewide`;
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
