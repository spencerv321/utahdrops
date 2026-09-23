import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProduct,
  getProductHistory,
  getStoreAvailability,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { Sparkline } from "@/components/sparkline";
import { WatchButton } from "@/components/watch-button";
import { StoreAvailability } from "@/components/store-availability";
import { displayName, formatAsOf, formatPrice, formatQty, formatSize } from "@/lib/format";
import { DABS_LOCATOR_URL, SITE_URL } from "@/lib/config";

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
  const [product, history, stores] = await Promise.all([
    getProduct(csc),
    getProductHistory(csc),
    getStoreAvailability(csc),
  ]);
  if (!product) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let watched = false;
  if (user) {
    const rows = (await sql`
      select 1 from watchlist where user_id = ${user.id} and csc = ${csc}`) as unknown as unknown[];
    watched = rows.length > 0;
  }

  const stocked = stores.filter((s) => s.qty > 0);
  const storeAsOf = stores.reduce<Date | null>(
    (latest, s) => (!latest || s.scraped_at > latest ? s.scraped_at : latest),
    null
  );

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
    <div className="space-y-8">
      <script
        type="application/ld+json"
        // Escape "<" so product text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {displayName(product.name)}
            </h1>
            <StatusBadge status={product.status} />
            {product.delisted_at ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                No longer listed by DABS
              </span>
            ) : null}
            {product.is_spa ? (
              <span className="text-xs font-medium text-destructive">SPA pricing</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{product.csc}</span>
            {product.category ? <> · {product.category}</> : null}
            {product.size_ml ? <> · {formatSize(product.size_ml)}</> : null}
          </p>
          {product.description ? (
            <p className="max-w-xl text-sm text-muted-foreground">{product.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="text-3xl font-semibold tabular-nums">
            {formatPrice(product.current_price)}
          </div>
          <WatchButton csc={csc} initialWatched={watched} signedIn={!!user} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat label="In stores statewide" value={formatQty(product.store_qty)} />
        <Stat label="At warehouse" value={formatQty(product.warehouse_qty)} />
        <Stat
          label="On order"
          value={formatQty(product.on_order_qty)}
          hint={(product.on_order_qty ?? 0) > 0 ? "incoming to DABS" : undefined}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Statewide quantity — last 90 days
        </h2>
        <Sparkline points={history} until={product.last_seen} />
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Store availability
            {stocked.length > 0 ? ` — ${stocked.length} store${stocked.length === 1 ? "" : "s"}` : ""}
          </h2>
          {storeAsOf ? (
            <span className="text-xs text-muted-foreground">
              as of {formatAsOf(storeAsOf)} MT
            </span>
          ) : null}
        </div>
        {stores.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Per-store data for this product hasn&apos;t been collected yet —
            check the{" "}
            <a className="underline" href={DABS_LOCATOR_URL} rel="noopener">
              official locator
            </a>{" "}
            in the meantime.
          </div>
        ) : (
          <StoreAvailability
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
      </section>

      <p className="text-xs text-muted-foreground">
        Quantities update when DABS refreshes counts (roughly nightly). Verify
        on the{" "}
        <a className="underline" href={DABS_LOCATOR_URL} rel="noopener">
          official DABS Product Locator
        </a>{" "}
        before driving. Last seen in catalog: {formatAsOf(product.last_seen)} MT.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
      {hint ? <div className="text-xs text-success">{hint}</div> : null}
    </div>
  );
}
