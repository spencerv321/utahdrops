import type { Metadata } from "next";
import { getDrops } from "@/lib/queries";
import { thirdSaturday } from "@/lib/dabs/allocated";
import { formatPrice } from "@/lib/format";
import { DropAlertSignup } from "@/components/drop-alert-signup";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Allocated & rare drops",
  description:
    "Utah DABS third-Saturday allocated drop tracker — current list, store assignments, and email alerts the moment the list posts.",
};

export default async function DropsPage() {
  const drops = await getDrops();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let optedIn = false;
  if (user) {
    const rows = (await sql`
      select allocated_email from alert_prefs where user_id = ${user.id}`) as unknown as {
      allocated_email: boolean;
    }[];
    optedIn = rows[0]?.allocated_email ?? false;
  }

  // Next drop countdown (MT ≈ UTC-6/-7; date-level precision is plenty)
  const now = new Date();
  let next = thirdSaturday(now.getUTCFullYear(), now.getUTCMonth());
  if (now.getTime() > next.getTime() + 86400_000) {
    next = thirdSaturday(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }
  const daysOut = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400_000));

  // Group by drop date, then by product
  const byDate = new Map<string, Map<string, typeof drops>>();
  for (const drop of drops) {
    const dateMap = byDate.get(drop.drop_date) ?? new Map();
    const productRows = dateMap.get(drop.product_name) ?? [];
    productRows.push(drop);
    dateMap.set(drop.product_name, productRows);
    byDate.set(drop.drop_date, dateMap);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Allocated &amp; rare drops</h1>
        <p className="text-sm text-muted-foreground">
          DABS releases allocated bottles on the third Saturday of each month,
          posting the list about a week before. Quantities shown are{" "}
          <strong>beginning quantities</strong>, not live counts.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Next drop</div>
          <div className="mt-1 text-2xl font-semibold">
            {next.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </div>
          <div className="text-sm text-muted-foreground">
            {daysOut === 0 ? "It's drop day" : `${daysOut} day${daysOut === 1 ? "" : "s"} away`}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Know the moment the list posts
          </div>
          <DropAlertSignup signedIn={!!user} optedIn={optedIn} />
        </div>
      </div>

      {byDate.size === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No drop list captured yet — it posts about a week before the third Saturday.
        </div>
      ) : (
        [...byDate.entries()].map(([date, products]) => (
          <section key={date} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}{" "}
              drop
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {products.size} products
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {[...products.entries()].map(([name, rows]) => {
                const totalBottles = rows.reduce((sum, r) => sum + (r.bottle_qty ?? 0), 0);
                return (
                  <div key={name} className="rounded-lg border bg-card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-medium">{name}</h3>
                      <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                        {formatPrice(rows[0].price)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {totalBottles} bottles · {rows.length} store{rows.length === 1 ? "" : "s"}
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {rows.slice(0, 6).map((r, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate">{r.store_text}</span>
                          <span className="shrink-0 tabular-nums">{r.bottle_qty ?? "?"}</span>
                        </li>
                      ))}
                      {rows.length > 6 ? (
                        <li className="text-xs">+ {rows.length - 6} more stores</li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Rare High Demand Products (lottery bottles) are handled through{" "}
        <a
          className="underline"
          href="https://webapps2.abc.utah.gov/ProdApps/RareHighDemandProducts"
          rel="noopener"
        >
          DABS&apos;s official drawing system
        </a>
        . Source:{" "}
        <a className="underline" href="https://abs.utah.gov/shop-products/allocatedandrare/" rel="noopener">
          DABS Allocated &amp; Rare
        </a>
        .
      </p>
    </div>
  );
}
