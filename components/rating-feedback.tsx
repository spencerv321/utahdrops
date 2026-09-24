"use client";

import { useState } from "react";
import type { RarityTier } from "@/lib/queries";

/** A small "Does this rating seem wrong?" note under the rating card. */
export function RatingFeedback({ csc, tier }: { csc: string; tier: RarityTier | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (state === "sent") {
    return <p className="text-sm text-muted-foreground">Thanks — we read every note.</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Does this rating seem wrong?
      </button>
    );
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    let visitor: string | null = null;
    try {
      visitor = localStorage.getItem("ud_vid");
    } catch {
      // storage blocked: send without it
    }
    const res = await fetch("/api/rating-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csc, tier, message, visitor }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }
  return (
    <form onSubmit={send} className="space-y-2">
      <label htmlFor={`rating-feedback-${csc}`} className="text-sm">
        What seems off? (e.g. &ldquo;it&apos;s always at my store&rdquo; or &ldquo;this is a yearly release&rdquo;)
      </label>
      <textarea
        id={`rating-feedback-${csc}`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={600}
        rows={3}
        className="w-full rounded-md border border-input bg-raised p-2 text-[15px]"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "sending" || message.trim().length < 3}
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        {state === "error" ? <span className="text-sm text-destructive">Couldn&apos;t send — try again later.</span> : null}
      </div>
    </form>
  );
}
