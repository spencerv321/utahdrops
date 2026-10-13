"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CalendarDays, House, Menu, Search, Star, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The four jobs, one tab each. Everything else sits behind "More". */
const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/drops", label: "Drops", icon: CalendarDays },
  { href: "/watchlist", label: "Watchlist", icon: Star },
];

/** Sections without a tab of their own; the desktop header shows most of them. */
export const MORE_LINKS: { href: string; label: string; note: string }[] = [
  { href: "/discover", label: "Worth a look", note: "Scarce bottles and real price drops" },
  { href: "/this-week", label: "This week", note: "The last 7 days at the stores" },
  { href: "/whats-new", label: "What's new", note: "Every restock, listing and price change" },
  { href: "/makers", label: "Utah makers", note: "Local breweries, distilleries, wineries" },
  { href: "/bars", label: "Bars & taverns", note: "Every licensed bar and what its license allows" },
  { href: "/drawings", label: "Drawing odds", note: "Your chances in DABS's rare-bottle drawings" },
  { href: "/utah-101", label: "Utah 101", note: "How buying and drinking works here" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const tabClass = (active: boolean) =>
  cn(
    "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
    active ? "text-primary" : "text-muted-foreground"
  );

/** Phone-only bottom navigation, within thumb reach. */
export function TabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link prefetch={false}
                href={href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger className={tabClass(moreActive)}>
              <Menu className="size-[22px]" strokeWidth={moreActive ? 2.2 : 1.7} aria-hidden />
              More
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
              <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t bg-background px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom">
                <div className="flex items-center justify-between">
                  <DialogPrimitive.Title className="font-display text-2xl leading-none">More</DialogPrimitive.Title>
                  <DialogPrimitive.Close className="-mr-2 flex size-11 items-center justify-center text-muted-foreground">
                    <X className="size-5" aria-hidden />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>
                <DialogPrimitive.Description className="sr-only">Other sections of Utah Drops</DialogPrimitive.Description>
                <ul className="mt-2 divide-y">
                  {MORE_LINKS.map((l) => {
                    const active = isActive(pathname, l.href);
                    return (
                      <li key={l.href}>
                        <Link prefetch={false}
                          href={l.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className="flex min-h-14 flex-col justify-center py-2"
                        >
                          <span className={cn("text-[17px]", active ? "text-primary" : "text-foreground")}>{l.label}</span>
                          <span className="text-[13px] text-subtle-foreground">{l.note}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </li>
      </ul>
    </nav>
  );
}
