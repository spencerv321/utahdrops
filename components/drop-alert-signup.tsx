"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { setAlertPrefs } from "@/app/actions";

/**
 * "Email me when the list posts": the monthly allocated-list alert. Signed-out
 * visitors go sign in first (and land back on Drops).
 */
export function DropAlertSignup({ signedIn, optedIn }: { signedIn: boolean; optedIn: boolean }) {
  const [on, setOn] = useState(optedIn);
  const [pending, startTransition] = useTransition();
  const button =
    "inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-center text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto";

  if (!signedIn) {
    return (
      <Link prefetch={false} href="/login?next=/drops" className={button}>
        <Bell className="size-4" aria-hidden />
        Email me the list
      </Link>
    );
  }

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const result = await setAlertPrefs({ allocatedEmail: next });
      if (!result.ok) {
        setOn(!next);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  if (on) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Check className="size-4 text-primary" aria-hidden />
          We&apos;ll email you when it posts.
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => toggle(false)}
          className="min-h-11 text-brand-muted underline underline-offset-4 hover:text-brand-foreground"
        >
          Turn off
        </button>
      </p>
    );
  }

  return (
    <button type="button" disabled={pending} onClick={() => toggle(true)} className={button}>
      <Bell className="size-4" aria-hidden />
      Email me the list
    </button>
  );
}
