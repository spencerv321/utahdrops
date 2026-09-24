import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Wordmark } from "@/components/wordmark";
import { NavLinks } from "@/components/nav-links";
import { isAdmin } from "@/lib/admin";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link prefetch={false} href="/" aria-label="Utah Drops, home" className="shrink-0 text-[15px]">
          <Wordmark />
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-4">
          {isAdmin(user) && (
            <Link prefetch={false} href="/admin" className="flex h-11 items-center px-1 text-sm text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          {/* Deliberately quiet: signing in happens naturally when you save a bottle. */}
          {user ? (
            <form action={signOut}>
              <button type="submit" className="h-11 px-1 text-sm text-muted-foreground hover:text-foreground">
                Sign out
              </button>
            </form>
          ) : (
            <Link prefetch={false} href="/login" className="flex h-11 items-center px-1 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
