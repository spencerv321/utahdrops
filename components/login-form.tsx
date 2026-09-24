"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div role="status" className="space-y-2 rounded-2xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
        <p className="font-display text-xl font-extrabold">Check your email</p>
        <p className="text-sm text-muted-foreground">
          Tap the link we just sent to sign in. It can take a minute; check spam if it doesn&apos;t show.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const email = new FormData(e.currentTarget).get("email") as string;
        startTransition(async () => {
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
            },
          });
          if (error) setError(error.message);
          else setSent(true);
        });
      }}
    >
      <label htmlFor="login-email" className="text-sm font-semibold">
        Email
      </label>
      <Input
        id="login-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        className="h-12 bg-card text-base"
      />
      <Button type="submit" className="h-12 w-full rounded-xl text-base font-bold" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
