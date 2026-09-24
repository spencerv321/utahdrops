import { Suspense } from "react";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { PageTracker } from "@/components/page-tracker";

async function Tracker() {
  const user = await getCurrentUser();
  // The owner's own browsing would skew the numbers.
  if (isAdmin(user)) return null;
  return <PageTracker userId={user?.id ?? null} />;
}

/** Page-view tracking for the admin dashboard; renders nothing visible. */
export function Analytics() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
