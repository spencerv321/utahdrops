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
