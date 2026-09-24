"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleWatch } from "@/app/actions";
import { cn } from "@/lib/utils";

/** Compact watch toggle for list rows. Signed-out visitors sign in with the bottle remembered. */
export function WatchStar({
  csc,
  name,
  initialWatched,
  signedIn,
  className,
}: {
  csc: string;
  name: string;
  initialWatched: boolean;
  signedIn: boolean;
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
        "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-card disabled:opacity-60",
        watched ? "text-primary" : "text-subtle-foreground hover:text-foreground",
        className
      )}
      onClick={() => {
        if (!signedIn) {
          // Sign in with this bottle remembered; the watch is added after they verify.
          router.push(`/login?watch=${csc}`);
          return;
        }
        const next = !watched;
        setWatched(next);
        startTransition(async () => {
          const result = await toggleWatch(csc, next);
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
    </button>
  );
}
