import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Wordmark } from "@/components/wordmark";
import { NavLinks } from "@/components/nav-links";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" aria-label="Utah Drops, home" className="shrink-0 text-[15px]">
          <Wordmark />
        </Link>
        <NavLinks />
        <div className="ml-auto">
          {/* Deliberately quiet: signing in happens naturally when you save a bottle. */}
          {user ? (
            <form action={signOut}>
              <button type="submit" className="h-11 px-1 text-sm text-muted-foreground hover:text-foreground">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="flex h-11 items-center px-1 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
