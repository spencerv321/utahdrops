import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getDrops, getUserStoreIds, type DropRow } from "@/lib/queries";
import { nextDropDate } from "@/lib/dabs/allocated";
import { formatPrice, productTitle, sizeFromName, sizeLabel, storeLabel } from "@/lib/format";
import { DropTicket } from "@/components/drop-ticket";
import { getCurrentUser } from "@/lib/supabase/server";
import { sql } from "@/lib/db";
import { DABS_ALLOCATED_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Allocated & rare drops",
  description:
    "Utah DABS third-Saturday allocated drop tracker — current list, store assignments, and email alerts when the list posts.",
};

const dateLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

export default async function DropsPage() {
  const [drops, user] = await Promise.all([getDrops(), getCurrentUser()]);

  let optedIn = false;
  if (user) {
    const rows = (await sql`
      select allocated_email from alert_prefs where user_id = ${user.id}`) as unknown as {
      allocated_email: boolean;
    }[];
    optedIn = rows[0]?.allocated_email ?? false;
  }
  const homeIds = new Set(await getUserStoreIds(user?.id));

  const now = new Date();
  const next = nextDropDate(now);
  const nextIso = next.toISOString().slice(0, 10);
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
    <div className="space-y-12 pt-2 sm:pt-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end lg:gap-14">
        <header className="space-y-3">
          <p className="kicker text-muted-foreground">Allocated &amp; rare</p>
          <h1 className="text-5xl leading-[0.95] sm:text-6xl">The monthly drop</h1>
          <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
            Some bottles are in such short supply that DABS allocates them: Blanton&apos;s, Weller, E.H. Taylor and
            friends. They go to a set list of stores on the third Saturday of the month, and DABS posts that list
            about a week before.
          </p>
        </header>
        <DropTicket size="large" explain={false} signedIn={!!user} optedIn={optedIn} />
      </div>

      <ol className="grid divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Step n={1} when={listPosted ? "Posted" : `Around ${dateLabel(listPostsAround, { month: "short", day: "numeric" })}`} what="DABS posts the list of bottles and stores." />
        <Step n={2} when="Minutes later" what="We email everyone with drop alerts on." />
        <Step n={3} when={dateLabel(nextIso, { weekday: "short", month: "short", day: "numeric" })} what="Bottles go out at the listed stores." />
      </ol>

      {byDate.size === 0 ? (
        <p className="border-y py-10 text-center text-muted-foreground">
          No list captured yet. It posts about a week before the third Saturday.
        </p>
      ) : (
        [...byDate.entries()].map(([date, products]) => (
          <section key={date} className="max-w-3xl space-y-3" aria-labelledby={`drop-${date}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`drop-${date}`} className="font-display text-[2rem] leading-none sm:text-4xl">
                {date === nextIso ? "This month's list" : `${dateLabel(date, { month: "long", day: "numeric" })} drop`}
              </h2>
              <p className="text-sm text-muted-foreground">
                {products.size} bottle{products.size === 1 ? "" : "s"} · counts are what each store started with
              </p>
            </div>
            <ul className="divide-y border-y">
              {[...products.entries()].map(([name, rows]) => (
                <DropRowItem key={name} name={name} rows={rows} homeIds={homeIds} />
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="text-xs text-subtle-foreground">
        Lottery bottles (&ldquo;rare high demand&rdquo;) go through{" "}
        <a className="underline underline-offset-4" href="https://webapps2.abc.utah.gov/ProdApps/RareHighDemandProducts" rel="noopener">
          DABS&apos;s drawing
        </a>{" "}
        instead. Source:{" "}
        <a className="underline underline-offset-4" href={DABS_ALLOCATED_URL} rel="noopener">
          DABS Allocated &amp; Rare
        </a>
        . Not affiliated with DABS.
      </p>
    </div>
  );
}

function Step({ n, when, what }: { n: number; when: string; what: string }) {
  return (
    <li className="flex gap-3 py-3 sm:px-4 sm:first:pl-0">
      <span className="font-display text-2xl leading-none text-primary">{n}</span>
      <span>
        <span className="block text-sm font-medium">{when}</span>
        <span className="block text-sm text-muted-foreground">{what}</span>
      </span>
    </li>
  );
}

function DropRowItem({ name, rows, homeIds }: { name: string; rows: DropRow[]; homeIds: Set<number> }) {
  const total = rows.reduce((sum, r) => sum + (r.bottle_qty ?? 0), 0);
  const csc = rows.find((r) => r.csc)?.csc;
  const place = (r: DropRow) => {
    if (!r.store_name) return r.store_text ?? "Unknown store";
    const l = storeLabel(r.store_name, r.store_city);
    return l.number ? `${l.title} #${l.number}` : l.title;
  };
  const mine = rows.filter((r) => r.store_id != null && homeIds.has(r.store_id));
  const size = sizeFromName(name);
  const title = productTitle(name, size);

  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        {csc ? (
          <Link prefetch={false} href={`/product/${csc}`} className="font-medium underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          <p className="font-medium">{title}</p>
        )}
        <p className="shrink-0 font-medium tabular-nums">{formatPrice(rows[0].price)}</p>
      </div>
      <p className="text-[13px] text-muted-foreground">
        {[sizeLabel(size), `${total} bottles to ${rows.length} store${rows.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
      </p>
      {mine.length > 0 ? (
        <p className="mt-1 text-[13px] font-medium text-success">
          {mine.map((r) => `${place(r)} got ${r.bottle_qty ?? "some"}`).join(" · ")}
        </p>
      ) : null}
      <details className="group mt-1">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          Which stores
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 border-t py-1.5">
              <span className="min-w-0 truncate">
                {place(r)}
                {r.store_name && r.store_text ? <span className="text-subtle-foreground"> · {r.store_text}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{r.bottle_qty ?? "?"}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
