"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin amber bar at the top while the next page loads, so a tap feels
 * answered. Pages don't stream a loading skeleton (crawlers and AI fetchers
 * would get the skeleton instead of the page), so this is the feedback.
 * Starts on a same-site link click; completes when the URL changes.
 */
export function NavProgress() {
  const here = `${usePathname()}?${useSearchParams().toString()}`;
  // The URL we were on when a link was tapped; null when idle.
  const [from, setFrom] = useState<string | null>(null);
  const loading = from !== null && from === here;
  const arrived = from !== null && from !== here;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setFrom(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
    };
    // Capture phase: next/link calls preventDefault() on its own click, before
    // a bubbling listener would see it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Fade out after arriving; give up after 15s if the URL never changes
  // (a link that redirects back here, or a failed navigation).
  useEffect(() => {
    if (from === null) return;
    const t = setTimeout(() => setFrom(null), arrived ? 450 : 15_000);
    return () => clearTimeout(t);
  }, [from, arrived]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        className="h-full bg-primary"
        style={{
          width: loading ? "80%" : arrived ? "100%" : "0%",
          opacity: arrived ? 0 : 1,
          transition: loading
            ? "width 8s cubic-bezier(0.1, 0.7, 0.3, 1)"
            : arrived
              ? "width 150ms ease-out, opacity 300ms ease-out 150ms"
              : "none",
        }}
      />
    </div>
  );
}
