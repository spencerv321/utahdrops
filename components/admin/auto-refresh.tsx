"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the dashboard every minute while the tab is visible. */
export function AutoRefresh({ renderedAt }: { renderedAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const secs = Math.max(0, Math.round((now - Date.parse(renderedAt)) / 1000));
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="text-xs text-subtle-foreground hover:text-foreground"
      title="Refresh now"
    >
      Updated {secs < 10 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`} · refresh
    </button>
  );
}
