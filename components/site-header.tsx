import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { GlassMark } from "@/components/glass-mark";
import { SITE_NAME } from "@/lib/config";

const NAV = [
  { href: "/", label: "Search" },
  { href: "/whats-new", label: "What's New" },
  { href: "/drops", label: "Drops" },
  { href: "/watchlist", label: "Watchlist" },
];

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      {/* Phones: logo + sign-in on one row, nav on its own scrollable row, so
          the header never forces the page wider than the viewport. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 sm:h-14 sm:flex-nowrap">
        <Link href="/" className="flex h-12 shrink-0 items-center gap-2 sm:h-auto">
          <GlassMark className="size-5 text-foreground" />
          <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight">{SITE_NAME}</span>
        </Link>
        <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-5 overflow-x-auto px-4 pb-2 text-sm text-muted-foreground sm:order-none sm:mx-0 sm:w-auto sm:gap-4 sm:overflow-visible sm:p-0">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap py-1 transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
                Sign out
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
