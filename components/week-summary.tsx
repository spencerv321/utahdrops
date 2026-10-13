import Link from "next/link";
import { getWeek, WEEK_DAYS, type WeekSectionKey } from "@/lib/week";
import { getNearby, getWatchedSet } from "@/lib/queries";
import type { User } from "@supabase/supabase-js";
import { getArea } from "@/lib/area-server";
import { NEARBY_MILES } from "@/lib/area";
import { HomeFeed } from "@/components/home-feed";
import { DropTicket } from "@/components/drop-ticket";
import { sql } from "@/lib/db";

const SECTIONS: Record<WeekSectionKey, { title: string; blurb: string; all: string; empty: string }> = {
  restock: {
    title: "Back in stores",
    blurb: "Sold out statewide, then restocked, and still on shelves.",
    all: "/whats-new?type=restock",
    empty: "No notable restocks this week.",
  },
  status: {
    title: "Newly allocated, limited or on clearance",
    blurb: "DABS changed how these are sold.",
    all: "/whats-new?type=status_change",
    empty: "No listing changes this week.",
  },
  price_drop: {
    title: "Price drops",
    blurb: "Down 5% or more.",
    all: "/whats-new?type=price_change",
    empty: "No real price drops this week.",
  },
  new_product: {
    title: "New listings",
    blurb: "New to DABS's catalog.",
    all: "/whats-new?type=new_product",
    empty: "No new listings this week.",
  },
  sold_out: {
    title: "Sold out",
    blurb: "Hard-to-find bottles that ran out statewide and haven't come back.",
    all: "/whats-new?type=out_of_stock",
    empty: "Nothing notable sold out this week.",
  },
};
const ORDER: WeekSectionKey[] = ["restock", "status", "price_drop", "new_product", "sold_out"];

const MT = "America/Denver";
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: MT });

/**
 * The last 7 days, grouped by what happened, hard-to-find bottles first. The
 * default view of What's new (it was its own page, /this-week, until Oct 2026).
 */
export async function WeekSummary({ user }: { user: User | null }) {
  const [sections, area] = await Promise.all([getWeek(10), getArea()]);
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const cscs = sections.flatMap((s) => s.events.map((e) => e.csc)).filter((c): c is string => !!c);
  const inStock = sections.flatMap((s) => s.events.filter((e) => e.in_stock).map((e) => e.csc as string));
  const [watched, nearby, optedIn] = await Promise.all([
    getWatchedSet(user?.id, cscs),
    area ? getNearby(inStock, area, NEARBY_MILES) : Promise.resolve(undefined),
    user
      ? (sql`select allocated_email from alert_prefs where user_id = ${user.id}` as unknown as Promise<
          { allocated_email: boolean }[]
        >).then((r) => r[0]?.allocated_email ?? false)
      : Promise.resolve(false),
  ]);

  const now = new Date();
  const from = new Date(now.getTime() - (WEEK_DAYS - 1) * 86400_000);
  const count = (k: WeekSectionKey) => byKey.get(k)?.total ?? 0;
  const summary = [
    [count("restock"), "back in stores"],
    [count("status"), "listing changes"],
    [count("price_drop"), "price drops"],
    [count("new_product"), "new listings"],
  ] as const;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-14">
        <header className="space-y-3">
          <p className="kicker text-muted-foreground">
            This week · {day(from)} – {day(now)}
          </p>
          <p className="max-w-prose text-[17px] leading-relaxed text-muted-foreground">
            What changed in the last 7 days, hard-to-find bottles first. Restocks mostly show up midweek, and the
            allocated drop lands on the third Saturday, so Friday is a good day to look.
          </p>
          <p className="text-sm">
            {summary.map(([n, label], i) => (
              <span key={label}>
                {i > 0 ? <span className="text-muted-foreground"> · </span> : null}
                <span className="font-medium tabular-nums">{n.toLocaleString("en-US")}</span> {label}
              </span>
            ))}
          </p>
        </header>
        <DropTicket signedIn={!!user} optedIn={optedIn} />
      </div>

      {ORDER.map((key) => {
        const s = byKey.get(key);
        const meta = SECTIONS[key];
        const id = `week-${key}`;
        return (
          <section key={key} className="max-w-3xl space-y-3" aria-labelledby={id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <h2 id={id} className="font-display text-[2rem] leading-none sm:text-4xl">
                  {meta.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
              </div>
              {s && s.total > s.events.length ? (
                <Link prefetch={false} href={meta.all} className="text-sm underline underline-offset-4">
                  All {s.total.toLocaleString("en-US")}
                </Link>
              ) : null}
            </div>
            <HomeFeed
              events={s?.events ?? []}
              watched={watched}
              signedIn={!!user}
              area={area}
              nearby={nearby}
              byDay={false}
              empty={meta.empty}
            />
          </section>
        );
      })}

      <p className="max-w-3xl text-xs text-subtle-foreground">
        From DABS&apos;s catalog, which we check about 3 times a day. Special orders, minis and multipacks are left out;{" "}
        <Link prefetch={false} className="underline underline-offset-4" href="/whats-new?type=all">
          Every change
        </Link>{" "}
        has the rest. Not affiliated with DABS.
      </p>
    </div>
  );
}
