"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { sendDiscoverEvent, visitorId } from "@/lib/beacon";
import { markBannerSeen, YEAR_IN_BOTTLES_PATH } from "@/lib/year-in-bottles-paths";

const SHOWN_KEY = "ud_yib_banner_shown";

export function YearBannerBar() {
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);
  const hidden = closed || pathname === YEAR_IN_BOTTLES_PATH || pathname.startsWith(`${YEAR_IN_BOTTLES_PATH}/`);

  // One impression per browser session, for click-through. Waits a moment so
  // the page tracker has set the visitor id the event needs.
  useEffect(() => {
    if (hidden) return;
    const t = setTimeout(() => {
      try {
        if (sessionStorage.getItem(SHOWN_KEY) || !visitorId()) return;
        sessionStorage.setItem(SHOWN_KEY, "1");
      } catch {
        return;
      }
      sendDiscoverEvent("shown", "year:banner");
    }, 1500);
    return () => clearTimeout(t);
  }, [hidden]);

  if (hidden) return null;
  return (
    <div className="flex items-center justify-center gap-1 border-b px-4 text-sm">
      <Link
        prefetch={false}
        href={YEAR_IN_BOTTLES_PATH}
        onClick={() => {
          sendDiscoverEvent("click", "year:banner");
          markBannerSeen();
        }}
        className="group inline-flex min-h-10 items-center gap-1.5 text-center"
      >
        <span className="text-subtle-foreground">New:</span>
        <span className="font-medium text-foreground underline decoration-primary underline-offset-4">
          Utah&apos;s Year in Bottles
        </span>
        <span className="hidden text-muted-foreground sm:inline">· what Utah bought this year</span>
        <ArrowRight className="size-4 text-primary" aria-hidden />
      </Link>
      <button
        type="button"
        aria-label="Hide this"
        onClick={() => {
          sendDiscoverEvent("click", "year:dismiss");
          markBannerSeen();
          setClosed(true);
        }}
        className="flex size-10 shrink-0 items-center justify-center text-subtle-foreground hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
