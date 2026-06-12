import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { ProductTable } from "@/components/product-table";
import { AlertPrefs } from "@/components/alert-prefs";
import type { ProductRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/watchlist");

  const [rows, prefRows] = await Promise.all([
    sql`
      select p.csc, p.name, p.category, p.status, p.size_ml, p.current_price::text,
             p.warehouse_qty, p.store_qty, p.on_order_qty, p.in_stock, p.is_spa
      from watchlist w
      join products p using (csc)
      where w.user_id = ${user.id}
      order by p.name` as unknown as Promise<ProductRow[]>,
    sql`
      select watchlist_email, allocated_email from alert_prefs
      where user_id = ${user.id}` as unknown as Promise<
      { watchlist_email: boolean; allocated_email: boolean }[]
    >,
  ]);

  const prefs = prefRows[0] ?? { watchlist_email: true, allocated_email: false };

  return (
    <div className="space-y-8">
      <section className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your watchlist</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}. We check inventory a few times a day and
          email you when something on this list changes.
        </p>
      </section>

      <AlertPrefs
        watchlistEmail={prefs.watchlist_email}
        allocatedEmail={prefs.allocated_email}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Nothing watched yet.{" "}
          <Link href="/" className="underline">
            Find a bottle
          </Link>{" "}
          and tap Watch.
        </div>
      ) : (
        <ProductTable rows={rows} />
      )}
    </div>
  );
}
