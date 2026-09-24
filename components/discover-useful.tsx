"use client";

import { useState } from "react";
import { sendDiscoverEvent } from "@/lib/beacon";

/** "Was this useful?" on /discover: one tap, counted on /admin. */
export function DiscoverUseful({ source }: { source: string }) {
  const [answered, setAnswered] = useState(false);
  if (answered) return <p className="text-sm text-muted-foreground">Thanks, that helps.</p>;
  const button =
    "inline-flex h-11 items-center rounded-md border border-input px-4 text-sm hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const answer = (kind: "useful_yes" | "useful_no") => {
    sendDiscoverEvent(kind, source);
    setAnswered(true);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">Was this list useful?</p>
      <button type="button" className={button} onClick={() => answer("useful_yes")}>
        Yes
      </button>
      <button type="button" className={button} onClick={() => answer("useful_no")}>
        Not really
      </button>
    </div>
  );
}
