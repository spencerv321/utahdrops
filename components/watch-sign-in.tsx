"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { requestWatchSignIn } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface WatchStoreOption {
  id: number;
  label: string;
}

/**
 * Sign-in that finishes the watch the visitor asked for: pick where to hear
 * about it, enter an email, tap the link. The watch is added after they
 * verify (app/watch/confirm), so they never have to tap Watch again.
 */
export function WatchSignIn({
  csc,
  productName,
  stores,
  initialStoreId,
}: {
  csc: string;
  productName: string;
  stores: WatchStoreOption[];
  initialStoreId?: number | null;
}) {
  const [scope, setScope] = useState<"statewide" | "store">(initialStoreId ? "store" : "statewide");
  const [storeId, setStoreId] = useState<string>(initialStoreId ? String(initialStoreId) : "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sentTo) {
    return (
      <div role="status" className="space-y-2 border-y py-8 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
        <p className="font-display text-3xl">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a link to {sentTo}. Tap it and you&apos;re watching {productName}; no need to tap Watch again. It can
          take a minute; check spam if it doesn&apos;t show.
        </p>
      </div>
    );
  }

  const option = "flex cursor-pointer gap-3 rounded-md border p-3.5 has-[:checked]:border-primary has-[:checked]:bg-primary/8";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        if (scope === "store" && !storeId) {
          setError("Choose a store, or pick “Anywhere in Utah”.");
          return;
        }
        setError(null);
        startTransition(async () => {
          const saved = await requestWatchSignIn({
            email,
            csc,
            storeId: scope === "store" ? Number(storeId) : null,
          });
          if (!saved.ok) {
            setError(saved.error);
            return;
          }
          const next = `/watch/confirm?intent=${saved.id}`;
          const { error } = await createClient().auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
          });
          if (error) setError(error.message);
          else setSentTo(email.trim());
        });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Email me when it&apos;s back</legend>
        <label className={option}>
          <input
            type="radio"
            name="scope"
            value="statewide"
            checked={scope === "statewide"}
            onChange={() => setScope("statewide")}
            className="mt-1 size-4 accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block font-medium">Anywhere in Utah</span>
            <span className="block text-sm text-muted-foreground">When DABS shows it back in stores statewide.</span>
          </span>
        </label>
        <label className={option}>
          <input
            type="radio"
            name="scope"
            value="store"
            checked={scope === "store"}
            onChange={() => setScope("store")}
            className="mt-1 size-4 accent-primary"
          />
          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="block font-medium">Also at my store</span>
            <span className="block text-sm text-muted-foreground">
              Adds a store you shop at. You&apos;ll hear when it&apos;s back there, as well as statewide.
            </span>
          </span>
        </label>
        {scope === "store" ? (
          <div className="pl-7">
            <label htmlFor="watch-store" className="sr-only">
              Your store
            </label>
            <select
              id="watch-store"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-raised px-3 text-base"
            >
              <option value="">Choose a store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </fieldset>

      <div className="space-y-3">
        <label htmlFor="watch-email" className="text-sm font-semibold">
          Email
        </label>
        <Input
          id="watch-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className="h-12 border-input bg-raised text-base"
        />
        <Button type="submit" className={cn("h-12 w-full rounded-md text-base font-semibold")} disabled={pending}>
          {pending ? "Sending…" : "Email me a link to start watching"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
