"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { signUpForEmails } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Footer signup. Records the segment answer (the demand-validation instrument
 * — keep the segment select), then emails a magic link so the address gets
 * real alerts: signing in lands on the watchlist with drop alerts to turn on.
 */
export function EmailCapture() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sentTo) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <MailCheck className="size-4 text-primary" />
        Check {sentTo} — tap the link to turn on your alerts.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signUpForEmails(formData);
          if (!result.ok || !result.email) {
            setError(result.error ?? "Something went wrong.");
            return;
          }
          const next = encodeURIComponent("/watchlist?welcome=1");
          const { error: authError } = await createClient().auth.signInWithOtp({
            email: result.email,
            options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${next}` },
          });
          if (authError) setError("Couldn't send the link — try again in a minute.");
          else setSentTo(result.email);
        });
      }}
    >
      <Input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-[1_1_14rem] border-input bg-raised text-base"
        aria-label="Email address"
      />
      <select
        name="segment"
        className="h-11 min-w-0 flex-[1_1_10rem] rounded-md border border-input bg-raised px-3 text-sm"
        aria-label="I am a"
        defaultValue="consumer"
      >
        <option value="consumer">I&apos;m a consumer</option>
        <option value="bar_restaurant">I run a bar / restaurant</option>
        <option value="supplier">I&apos;m a supplier / distillery</option>
        <option value="other">Other</option>
      </select>
      <Button type="submit" disabled={pending} className="h-auto min-h-11 min-w-0 flex-[1_1_auto] px-5 font-semibold whitespace-normal">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </form>
  );
}
