import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { ProductList } from "@/components/product-list";
import { AlertPrefs } from "@/components/alert-prefs";
import { HomeStores, type StoreOption } from "@/components/home-stores";
import type { ProductRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/watchlist");

  const [rows, prefRows, storeOptions, homeRows] = await Promise.all([
    sql`
      select p.csc, p.name, p.category, p.status, p.size_ml, p.current_price::text,
             p.warehouse_qty, p.store_qty, p.on_order_qty, p.in_stock, p.is_spa
      from watchlist w
      join products p using (csc)
      where w.user_id = ${user.id}
      order by p.in_stock desc, p.name` as unknown as Promise<ProductRow[]>,
    sql`
      select watchlist_email, allocated_email from alert_prefs
      where user_id = ${user.id}` as unknown as Promise<
      { watchlist_email: boolean; allocated_email: boolean }[]
    >,
    sql`select id, name, city from stores order by city nulls last, name` as unknown as Promise<StoreOption[]>,
    sql`select store_id from user_stores where user_id = ${user.id} order by created_at` as unknown as Promise<
      { store_id: number }[]
    >,
  ]);

  const prefs = prefRows[0] ?? { watchlist_email: true, allocated_email: false };
  const inStock = rows.filter((r) => r.in_stock).length;

  return (
    <div className="space-y-12">
      <section className="space-y-2 pt-2 sm:pt-6">
        <h1 className="text-5xl leading-none sm:text-6xl">Your watchlist</h1>
        <p className="text-muted-foreground">
          We check stock several times a day and email {user.email} when something changes.
        </p>
      </section>

      {welcome ? (
        <div role="status" className="border-y border-success/40 py-4 text-[15px]">
          <strong className="font-medium text-success">You&apos;re in.</strong> Pick your stores and turn on drop alerts below, then tap the star
          on any bottle to get an email when it&apos;s back.
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="bottles-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="bottles-title" className="font-display text-[2rem] leading-none sm:text-4xl">
            Bottles you watch
          </h2>
          {rows.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {inStock} of {rows.length} in stores now
            </span>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <div className="border-y py-8 text-center text-muted-foreground">
            Nothing yet.{" "}
            <Link href="/search" className="text-foreground underline underline-offset-4">
              Find a bottle
            </Link>{" "}
            and tap its star.
          </div>
        ) : (
          <ProductList rows={rows} watched={new Set(rows.map((r) => r.csc))} signedIn />
        )}
      </section>

      <HomeStores stores={storeOptions} selected={homeRows.map((r) => r.store_id)} />

      <section className="space-y-3" aria-labelledby="alerts-title">
        <h2 id="alerts-title" className="font-display text-[2rem] leading-none sm:text-4xl">
          Email alerts
        </h2>
        <AlertPrefs watchlistEmail={prefs.watchlist_email} allocatedEmail={prefs.allocated_email} />
      </section>
    </div>
  );
}
