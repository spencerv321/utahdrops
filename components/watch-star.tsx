"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleWatch } from "@/app/actions";
import { cn } from "@/lib/utils";

/** Compact watch toggle for list rows. Signed-out visitors go sign in first. */
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
  const pathname = usePathname();
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
        "flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-secondary disabled:opacity-60",
        className
      )}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
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
      <Star className={cn("size-[22px]", watched && "fill-current")} aria-hidden />
    </button>
  );
}
