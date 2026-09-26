"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleWatch } from "@/app/actions";
import { cn } from "@/lib/utils";
import { sendDiscoverEvent, trackedSource, visitorId } from "@/lib/beacon";

/**
 * Compact watch toggle for list rows. Signed-out visitors sign in with the
 * bottle remembered. `source` ("discover:price", "search:exact") attributes
 * the tap, the email request and the confirmed watch to that list, through
 * sign-in if needed. `label` shows a word beside the star.
 */
export function WatchStar({
  csc,
  name,
  initialWatched,
  signedIn,
  source,
  label = false,
  className,
}: {
  csc: string;
  name: string;
  initialWatched: boolean;
  signedIn: boolean;
  source?: string;
  label?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={watched ? `Stop watching ${name}` : `Watch ${name} for restocks`}
      title={watched ? "Watching" : "Watch for restocks"}
      disabled={pending}
      className={cn(
        label
          ? "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-60"
          : "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-card disabled:opacity-60",
        watched ? "text-primary" : label ? "text-foreground" : "text-subtle-foreground hover:text-foreground",
        className
      )}
      onClick={() => {
        const src = trackedSource(source);
        if (src && !watched) sendDiscoverEvent("watch_click", src, csc);
        if (!signedIn) {
          // Sign in with this bottle remembered; the watch is added after they verify.
          router.push(`/login?watch=${csc}${src ? `&src=${encodeURIComponent(src)}` : ""}`);
          return;
        }
        const next = !watched;
        setWatched(next);
        startTransition(async () => {
          const result = await toggleWatch(csc, next, src && next ? { source: src, visitorId: visitorId() } : undefined);
          if (!result.ok) {
            setWatched(!next);
            toast.error(
              result.error === "watchlist_full"
                ? "Your watchlist is full. Remove a bottle first."
                : "Couldn't update your watchlist. Try again."
            );
          } else if (next) {
            toast.success(`Watching ${name}. We'll email you when it's back.`);
          }
        });
      }}
    >
      <Star className={cn("size-5", watched && "fill-current")} strokeWidth={1.7} aria-hidden />
      {label ? (watched ? "Watching" : "Watch") : null}
    </button>
  );
}
