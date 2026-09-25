"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { checkedAgo, whenLabel } from "@/lib/format";

type Reply = { status: string; checkedAt?: string };

/**
 * "Check DABS now": asks DABS for this bottle's store-by-store counts
 * (app/api/check/[csc]) and re-renders the page with them. Only on a tap,
 * for someone deciding whether to drive; results are dated, since DABS's own
 * delay between a sale and its locator isn't known.
 */
export function CheckDabsButton({ csc }: { csc: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    setNote(null);
    let reply: Reply;
    try {
      const res = await fetch(`/api/check/${csc}`, { method: "POST" });
      reply = await res.json();
    } catch {
      reply = { status: "failed" };
    }
    setChecking(false);
    switch (reply.status) {
      case "checked":
        setNote(`Updated with what DABS showed ${whenLabel(reply.checkedAt)}.`);
        startRefresh(() => router.refresh());
        break;
      case "recent":
        setNote(`We checked DABS ${checkedAgo(reply.checkedAt!)}, so these counts are that check.`);
        startRefresh(() => router.refresh());
        break;
      case "busy":
        setNote("Someone is checking this bottle right now. Try again in a few seconds.");
        break;
      case "limited":
        setNote("You've run a lot of checks. Try again in a little while, or call the store.");
        break;
      case "capacity":
        setNote("We've used today's live checks. Call the store, or use the official DABS locator.");
        break;
      default:
        setNote("DABS didn't answer. The counts below are from our last check; call the store to be sure.");
    }
  }

  const busy = checking || refreshing;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={check}
        disabled={busy}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-input px-4 text-[15px] hover:bg-card disabled:opacity-60"
      >
        <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} aria-hidden />
        {checking ? "Checking DABS…" : "Check DABS now"}
      </button>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {note ?? "Live store counts from DABS for this bottle. Takes a few seconds."}
      </p>
    </div>
  );
}
