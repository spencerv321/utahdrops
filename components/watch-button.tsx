"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleWatch } from "@/app/actions";
import { cn } from "@/lib/utils";

/** The product page's big watch toggle. Signed-out visitors sign in first. */
export function WatchButton({
  csc,
  initialWatched,
  signedIn,
  className,
}: {
  csc: string;
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
      disabled={pending}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-base font-semibold transition-opacity disabled:opacity-70",
        watched ? "border border-input text-foreground hover:bg-raised" : "bg-primary text-primary-foreground hover:opacity-90",
        className
      )}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=/product/${csc}`);
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
          }
        });
      }}
    >
      <Star className={cn("size-5", watched && "fill-current text-primary")} aria-hidden />
      {watched ? "Watching this bottle" : "Watch this bottle"}
    </button>
  );
}
