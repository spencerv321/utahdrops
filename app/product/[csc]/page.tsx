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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayName, formatAsOf, formatPrice, formatQty, formatSize } from "@/lib/format";
import { DABS_LOCATOR_URL } from "@/lib/config";

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
  const storeAsOf = stores[0]?.scraped_at ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {displayName(product.name)}
            </h1>
            <StatusBadge status={product.status} />
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
        <div className="flex flex-col items-end gap-2">
          <div className="text-3xl font-semibold tabular-nums">
            {formatPrice(product.current_price)}
          </div>
          <WatchButton csc={csc} initialWatched={watched} signedIn={!!user} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
        <Sparkline points={history} />
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
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Store</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((s) => (
                  <TableRow key={s.store_id} className={s.qty === 0 ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm">{s.address}</TableCell>
                    <TableCell className="text-sm">{s.city}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.phone}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{s.qty}</TableCell>
                    <TableCell>
                      {s.lat != null ? (
                        <a
                          className="text-xs text-muted-foreground underline"
                          href={`https://maps.google.com/?q=${s.lat},${s.lng}`}
                          rel="noopener"
                          target="_blank"
                        >
                          map
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-success">{hint}</div> : null}
    </div>
  );
}
