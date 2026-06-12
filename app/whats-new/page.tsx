import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  PackageCheck,
  PackagePlus,
  PackageX,
  Sparkle,
} from "lucide-react";
import { getEvents } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { displayName, formatPrice, timeAgo } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";

const ICON = "inline-block size-3.5 mr-1.5 align-[-0.15em]";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What's new",
  description:
    "New products, restocks, clearance flags, and price changes across Utah's state liquor system.",
};

const TABS = [
  { key: "", label: "Everything" },
  { key: "new_product", label: "New products" },
  { key: "restock", label: "Restocks" },
  { key: "status_change", label: "Status changes" },
  { key: "price_change", label: "Price changes" },
] as const;

export default async function WhatsNewPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const events = await getEvents(type || undefined);

  return (
    <div className="space-y-6">
      <section className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">What&apos;s new at DABS</h1>
        <p className="text-sm text-muted-foreground">
          Every change we detect between scrapes — the page DABS can&apos;t show you.
        </p>
      </section>

      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key ? `/whats-new?type=${tab.key}` : "/whats-new"}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              (type ?? "") === tab.key
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Nothing yet — events appear once the scraper has two passes to compare.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                {e.csc ? (
                  <Link href={`/product/${e.csc}`} className="font-medium hover:underline">
                    {e.name ? displayName(e.name) : e.csc}
                  </Link>
                ) : (
                  <span className="font-medium">Allocated list posted</span>
                )}
                <div className="text-sm text-muted-foreground">
                  <EventLine type={e.event_type} detail={e.detail} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {e.csc ? <StatusBadge status={e.status} /> : null}
                <span className="w-16 text-right text-xs text-muted-foreground">
                  {timeAgo(e.created_at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventLine({ type, detail }: { type: string; detail: Record<string, unknown> }) {
  switch (type) {
    case "new_product":
      return <><PackagePlus className={ICON} />New product · {formatPrice(detail.price as number)}</>;
    case "restock":
      return <><PackageCheck className={ICON} />Back in stock — {String(detail.qty ?? "?")} bottles statewide</>;
    case "out_of_stock":
      return <><PackageX className={ICON} />Out of stock statewide</>;
    case "price_change": {
      const oldP = Number(detail.old);
      const newP = Number(detail.new);
      const drop = newP < oldP;
      return (
        <span className={drop ? "text-success" : ""}>
          {drop ? <ArrowDown className={ICON} /> : <ArrowUp className={ICON} />}
          {formatPrice(oldP)} → {formatPrice(newP)}
        </span>
      );
    }
    case "status_change":
      return (
        <>
          <ArrowRight className={ICON} />
          {STATUS_LABELS[String(detail.old)] ?? detail.old} →{" "}
          {STATUS_LABELS[String(detail.new)] ?? detail.new}
          {detail.new === "D" ? " — clearance window" : ""}
        </>
      );
    case "allocated_drop":
      return <><Sparkle className={ICON} />{String(detail.count ?? "")} products on the list — <Link href="/drops" className="underline">see the drop</Link></>;
    default:
      return <>{type}</>;
  }
}
