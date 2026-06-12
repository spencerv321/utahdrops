"use client";

import { useState, useTransition } from "react";
import { signUpForEmails } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The Phase 3 validation instrument: every signup answers the segment
 * question. Do not remove the segment select.
 */
export function EmailCapture({ context }: { context?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        ✓ You&apos;re on the list. We&apos;ll only email when something changes.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      action={(formData) => {
        startTransition(async () => {
          const result = await signUpForEmails(formData);
          if (result.ok) setDone(true);
          else setError(result.error ?? "Something went wrong.");
        });
      }}
    >
      {context ? <input type="hidden" name="context" value={context} /> : null}
      <Input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="sm:w-56"
        aria-label="Email address"
      />
      <select
        name="segment"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        aria-label="I am a"
        defaultValue="consumer"
      >
        <option value="consumer">I&apos;m a consumer</option>
        <option value="bar_restaurant">I run a bar / restaurant</option>
        <option value="supplier">I&apos;m a supplier / distillery</option>
        <option value="other">Other</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Joining…" : "Get updates"}
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </form>
  );
}
