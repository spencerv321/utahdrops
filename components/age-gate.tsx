"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { GlassMark } from "@/components/glass-mark";
import { SITE_NAME } from "@/lib/config";

const COOKIE = "bf_age_ok";

const subscribe = () => () => {};

export function AgeGate() {
  // Server snapshot = confirmed, so crawlers and SSR never render the gate.
  const confirmed = useSyncExternalStore(
    subscribe,
    () => document.cookie.includes(`${COOKIE}=1`),
    () => true
  );
  const [dismissed, setDismissed] = useState(false);

  if (confirmed || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-md rounded-xl border bg-card p-8 text-center shadow-lg">
        <GlassMark className="mx-auto mb-3 size-10 text-foreground" />
        <h2 id="age-gate-title" className="mb-2 font-display text-xl font-semibold">Are you 21 or older?</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {SITE_NAME} shows inventory for Utah state liquor stores. You must be
          of legal drinking age to use this site.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => {
              document.cookie = `${COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}`;
              setDismissed(true);
            }}
          >
            I&apos;m 21 or older
          </Button>
          <Button variant="outline" asChild>
            <a href="https://abs.utah.gov">No, take me away</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
