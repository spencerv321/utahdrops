"use client";

import { Share } from "lucide-react";
import { toast } from "sonner";

/** Native share sheet on phones; copies the link elsewhere. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Share"
      className={className}
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            // dismissed
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied");
        } catch {
          toast.error("Couldn't copy the link");
        }
      }}
    >
      <Share className="size-5" aria-hidden />
    </button>
  );
}
