import { Suspense } from "react";
import { getCurrentUser } from "@/lib/supabase/server";
import { isUntracked } from "@/lib/admin";
import { PageTracker } from "@/components/page-tracker";
import { NoTrack } from "@/components/no-track";

async function Tracker() {
  const user = await getCurrentUser();
  // The owner's own browsing (admin or +test accounts) would skew the numbers,
  // and the browser stays untracked after signing out.
  if (isUntracked(user)) return <NoTrack />;
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
