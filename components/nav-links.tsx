"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/components/tab-bar";
import { cn } from "@/lib/utils";

// Utah 101 only fits beside the others from lg up; smaller screens reach it
// from the home page and the footer. The full change log (/whats-new) is linked
// from This week and the home feed rather than the menu.
const NAV: { href: string; label: string; wideOnly?: boolean }[] = [
  { href: "/search", label: "Search" },
  { href: "/discover", label: "Hard to find" },
  { href: "/drops", label: "Allocated" },
  { href: "/this-week", label: "This week" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/utah-101", label: "Utah 101", wideOnly: true },
];

/** Desktop header navigation. Phones use the bottom tab bar instead. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden h-full items-stretch gap-6 sm:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link prefetch={false}
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center border-b-2 pt-0.5 text-sm transition-colors",
              item.wideOnly && "hidden lg:flex",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
