import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { GlassMark } from "@/components/glass-mark";
import { NavLinks } from "@/components/nav-links";
import { SITE_NAME } from "@/lib/config";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label={`${SITE_NAME} home`}>
          <GlassMark className="size-6 text-foreground" />
          <span className="font-display text-[23px] font-extrabold lowercase tracking-[-0.03em]">
            {SITE_NAME}
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center">
          {user ? (
            <form action={signOut}>
              <Button variant="ghost" type="submit" className="h-11 text-muted-foreground">
                Sign out
              </Button>
            </form>
          ) : (
            <Button asChild className="h-10 rounded-full px-4 font-semibold sm:h-10">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
