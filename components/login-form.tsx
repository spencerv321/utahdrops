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
      <div className="rounded-lg border bg-card p-6 text-center text-sm">
        <MailCheck className="mx-auto mb-2 size-6 text-primary" />
        Check your email — the sign-in link is on its way.
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
      <Input type="email" name="email" required placeholder="you@example.com" className="h-11" />
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
