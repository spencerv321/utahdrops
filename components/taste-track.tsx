"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Mode = "typed" | "guided" | "followup";

/** The page tracker's random visitor id (components/page-tracker.tsx), if any. */
function visitorId(): string | null {
  try {
    return localStorage.getItem("ud_vid");
  } catch {
    return null;
  }
}

export function sendTasteEvent(event: Record<string, unknown>) {
  const body = JSON.stringify({ ...event, visitor: visitorId() });
  try {
    if (navigator.sendBeacon?.("/api/taste-events", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through
  }
  fetch("/api/taste-events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}

/** Records that taste results were shown (once per distinct request). */
export function TasteShown({ mode, request, results }: { mode: Mode; request: Record<string, unknown>; results: number }) {
  const key = JSON.stringify(request);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === key) return;
    sent.current = key;
    sendTasteEvent({ kind: "shown", mode, request, results });
  }, [key, mode, request, results]);
  return null;
}

/** A link to a recommended bottle that records the click. */
export function TasteLink({
  href,
  csc,
  rank,
  mode,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  csc: string;
  rank: number;
  mode: Mode;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => sendTasteEvent({ kind: "click", csc, rank, mode })}
    >
      {children}
    </Link>
  );
}

/** "Were these useful?" Yes / No, once. */
export function TasteFeedback({ mode, request }: { mode: Mode; request: Record<string, unknown> }) {
  const [answered, setAnswered] = useState<boolean | null>(null);
  if (answered !== null) {
    return <p className="text-sm text-muted-foreground" role="status">Thanks, that helps us tune this beta.</p>;
  }
  const btn = "inline-flex min-h-10 items-center rounded-md border border-input px-3.5 text-sm hover:border-primary";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Were these picks useful?</span>
      {[true, false].map((useful) => (
        <button
          key={String(useful)}
          type="button"
          className={btn}
          onClick={() => {
            setAnswered(useful);
            sendTasteEvent({ kind: "feedback", mode, request, useful });
          }}
        >
          {useful ? "Yes" : "Not really"}
        </button>
      ))}
    </div>
  );
}
