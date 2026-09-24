import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getDrops, getUserStoreIds, type DropRow } from "@/lib/queries";
import { nextDropDate } from "@/lib/dabs/allocated";
import { displayName, formatPrice, storeLabel } from "@/lib/format";
import { DropAlertSignup } from "@/components/drop-alert-signup";
import { createClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { DABS_ALLOCATED_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Allocated & rare drops",
  description:
    "Utah DABS third-Saturday allocated drop tracker — current list, store assignments, and email alerts the moment the list posts.",
};

const dateLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

export default async function DropsPage() {
  const supabase = await createClient();
  const [drops, { data: { user } }] = await Promise.all([getDrops(), supabase.auth.getUser()]);

  let optedIn = false;
  if (user) {
    const rows = (await sql`
      select allocated_email from alert_prefs where user_id = ${user.id}`) as unknown as {
      allocated_email: boolean;
    }[];
    optedIn = rows[0]?.allocated_email ?? false;
  }
  const homeIds = new Set(await getUserStoreIds(user?.id));

  // Next drop countdown (MT ≈ UTC-6/-7; date-level precision is plenty)
  const now = new Date();
  const next = nextDropDate(now);
  const nextIso = next.toISOString().slice(0, 10);
  const daysOut = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400_000));
  const listPosted = drops.some((d) => d.drop_date === nextIso);
  const listPostsAround = new Date(next.getTime() - 7 * 86400_000).toISOString().slice(0, 10);

  // Group by drop date, then by product
  const byDate = new Map<string, Map<string, DropRow[]>>();
  for (const drop of drops) {
    const dateMap = byDate.get(drop.drop_date) ?? new Map<string, DropRow[]>();
    const productRows = dateMap.get(drop.product_name) ?? [];
    productRows.push(drop);
    dateMap.set(drop.product_name, productRows);
    byDate.set(drop.drop_date, dateMap);
  }

  return (
    <div className="space-y-10">
      <section className="-mx-4 -mt-6 space-y-5 bg-brand px-4 pt-6 pb-7 text-brand-foreground sm:mx-0 sm:mt-0 sm:rounded-3xl sm:p-8">
        <p className="text-xs font-bold tracking-[0.1em] text-gold uppercase">Next allocated drop</p>
        <div className="space-y-1">
          <h1 className="text-6xl leading-[0.85] tracking-[-0.05em] sm:text-7xl">
            {dateLabel(nextIso, { month: "short", day: "numeric" })}
          </h1>
          <p className="text-base text-brand-muted">
            {dateLabel(nextIso, { weekday: "long" })} ·{" "}
            {daysOut === 0 ? "it's drop day" : `${daysOut} day${daysOut === 1 ? "" : "s"} out`}
          </p>
        </div>
        <ol className="grid grid-cols-3 gap-2">
          <Step when={listPosted ? "Posted" : `~${dateLabel(listPostsAround, { month: "short", day: "numeric" })}`} what="DABS posts the list" />
          <Step when="Minutes later" what="We email you" />
          <Step when={dateLabel(nextIso, { month: "short", day: "numeric" })} what="Bottles hit stores" />
        </ol>
        <div className="max-w-md">
          <DropAlertSignup signedIn={!!user} optedIn={optedIn} />
        </div>
        <p className="text-sm text-brand-muted">
          DABS releases allocated bottles on the third Saturday of each month. Lottery bottles go through{" "}
          <a
            className="font-semibold text-brand-foreground underline"
            href="https://webapps2.abc.utah.gov/ProdApps/RareHighDemandProducts"
            rel="noopener"
          >
            DABS&apos;s drawing
          </a>{" "}
          instead.
        </p>
      </section>

      {byDate.size === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          No drop list captured yet. It posts about a week before the third Saturday.
        </div>
      ) : (
        [...byDate.entries()].map(([date, products]) => (
          <section key={date} className="space-y-3" aria-labelledby={`drop-${date}`}>
            <div>
              <h2 id={`drop-${date}`} className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
                {date === nextIso ? "This month's list" : `${dateLabel(date, { month: "long", day: "numeric" })} drop`}
                <span className="ml-2 font-sans text-base font-medium text-muted-foreground">
                  {products.size} bottle{products.size === 1 ? "" : "s"}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Quantities are what each store started with, not live counts.
              </p>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {[...products.entries()].map(([name, rows]) => (
                <DropCard key={name} name={name} rows={rows} homeIds={homeIds} />
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Source:{" "}
        <a className="underline" href={DABS_ALLOCATED_URL} rel="noopener">
          DABS Allocated &amp; Rare
        </a>
        . Not affiliated with DABS.
      </p>
    </div>
  );
}

function Step({ when, what }: { when: string; what: string }) {
  return (
    <li className="space-y-1 rounded-xl bg-brand-raised p-3">
      <p className="text-xs font-bold text-gold">{when}</p>
      <p className="text-[13px] leading-snug">{what}</p>
    </li>
  );
}

function DropCard({ name, rows, homeIds }: { name: string; rows: DropRow[]; homeIds: Set<number> }) {
  const total = rows.reduce((sum, r) => sum + (r.bottle_qty ?? 0), 0);
  const csc = rows.find((r) => r.csc)?.csc;
  const place = (r: DropRow) =>
    r.store_name ? storeLabel(r.store_name, r.store_city).title : (r.store_text ?? "Unknown store");
  const mine = rows.filter((r) => r.store_id != null && homeIds.has(r.store_id));
  const title = displayName(name);

  return (
    <li className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        {csc ? (
          <Link href={`/product/${csc}`} className="font-display text-lg leading-tight font-bold hover:underline">
            {title}
          </Link>
        ) : (
          <p className="font-display text-lg leading-tight font-bold">{title}</p>
        )}
        <p className="shrink-0 font-display text-lg font-extrabold text-primary tabular-nums">{formatPrice(rows[0].price)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary px-3 py-2">
          <p className="text-xl font-bold tabular-nums">{total}</p>
          <p className="text-xs text-muted-foreground">bottles</p>
        </div>
        <div className="rounded-xl bg-secondary px-3 py-2">
          <p className="text-xl font-bold tabular-nums">{rows.length}</p>
          <p className="text-xs text-muted-foreground">store{rows.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      {mine.length > 0 ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">
          {mine.map((r) => `${place(r)} got ${r.bottle_qty ?? "some"}`).join(" · ")}
        </p>
      ) : null}
      <details className="group">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-xl border px-3 text-sm font-bold text-primary">
          Which stores
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{place(r)}</span>
                {r.store_name && r.store_text ? (
                  <span className="block truncate text-xs text-muted-foreground">{r.store_text}</span>
                ) : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{r.bottle_qty ?? "?"}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
