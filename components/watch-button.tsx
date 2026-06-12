"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toggleWatch } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WatchButton({
  csc,
  initialWatched,
  signedIn,
}: {
  csc: string;
  initialWatched: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={watched ? "secondary" : "default"}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=/product/${csc}`);
          return;
        }
        const next = !watched;
        setWatched(next);
        startTransition(async () => {
          const result = await toggleWatch(csc, next);
          if (!result.ok) setWatched(!next);
        });
      }}
    >
      <Star className={cn("size-4", watched && "fill-current")} />
      {watched ? "Watching" : "Watch for restocks"}
    </Button>
  );
}
