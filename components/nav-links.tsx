"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/components/tab-bar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/drops", label: "Drops" },
  { href: "/whats-new", label: "What's new" },
  { href: "/watchlist", label: "Watchlist" },
];

/** Desktop header navigation. Phones use the bottom tab bar instead. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-2 text-[15px] font-semibold transition-colors",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
