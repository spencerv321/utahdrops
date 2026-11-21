"use client";

import { Share } from "lucide-react";
import { toast } from "sonner";
import { sendDiscoverEvent } from "@/lib/beacon";
import { shareUrl, type ShareSurface } from "@/lib/share";

/**
 * Native share sheet on phones; copies the link elsewhere. Records the tap and
 * how it went (share_tap, then share_native or share_copy; a dismissed sheet
 * records only the tap), and tags the link with ?ref=share.
 */
export function ShareButton({
  title,
  surface,
  csc,
  className,
}: {
  title: string;
  surface: ShareSurface;
  csc?: string | null;
  className?: string;
}) {
  const source = `share:${surface}`;
  return (
    <button
      type="button"
      aria-label="Share"
      className={className}
      onClick={async () => {
        const url = shareUrl(window.location.href);
        sendDiscoverEvent("share_tap", source, csc);
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            sendDiscoverEvent("share_native", source, csc);
          } catch {
            // dismissed
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          sendDiscoverEvent("share_copy", source, csc);
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
