import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { releaseIdleConnections } from "@/lib/db-release";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — session refresh happens in proxy.ts
          }
        },
      },
    }
  );
}

/**
 * The signed-in user, verified once per request. The header, footer and page
 * all need it; without this each asked Supabase Auth separately (a network
 * round trip apiece) on every page view.
 */
export const getCurrentUser = cache(async () => {
  // Every page and action asks for the user once, so this is the one place
  // that reliably runs per request (see lib/db-release.ts).
  releaseIdleConnections();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
