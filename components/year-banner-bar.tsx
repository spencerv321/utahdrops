"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { markBannerSeen, YEAR_IN_BOTTLES_PATH } from "@/lib/year-in-bottles-paths";

export function YearBannerBar() {
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);
  if (closed || pathname === YEAR_IN_BOTTLES_PATH || pathname.startsWith(`${YEAR_IN_BOTTLES_PATH}/`)) return null;
  return (
    <div className="flex items-center justify-center gap-1 border-b px-4 text-sm">
      <Link
        prefetch={false}
        href={YEAR_IN_BOTTLES_PATH}
        onClick={markBannerSeen}
        className="group inline-flex min-h-10 items-center gap-1.5 text-center"
      >
        <span className="text-subtle-foreground">New:</span>
        <span className="font-medium text-foreground underline decoration-primary underline-offset-4">Utah&apos;s Year in Bottles</span>
        <span className="hidden text-muted-foreground sm:inline">· what Utah bought this year</span>
        <ArrowRight className="size-4 text-primary" aria-hidden />
      </Link>
      <button
        type="button"
        aria-label="Hide this"
        onClick={() => {
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
