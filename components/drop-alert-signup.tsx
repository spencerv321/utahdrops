"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setAlertPrefs } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DropAlertSignup({
  signedIn,
  optedIn,
}: {
  signedIn: boolean;
  optedIn: boolean;
}) {
  const [on, setOn] = useState(optedIn);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Get an email the moment the allocated list posts — usually a week
          before drop day.
        </p>
        <Button size="sm" asChild>
          <Link href="/login?next=/drops">Sign in to enable</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {on
          ? "✓ You'll get an email the moment the list posts."
          : "One email per month, the moment the list posts."}
      </p>
      <Button
        size="sm"
        variant={on ? "secondary" : "default"}
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          startTransition(async () => {
            const result = await setAlertPrefs({ allocatedEmail: next });
            if (!result.ok) setOn(!next);
          });
        }}
      >
        {on ? "Disable drop alerts" : "Enable drop alerts"}
      </Button>
    </div>
  );
}
