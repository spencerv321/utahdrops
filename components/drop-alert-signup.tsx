"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { setAlertPrefs } from "@/app/actions";

const COPY = {
  allocated: { cta: "Email me the list", on: "We'll email you when it posts.", back: "/drops" },
  drawing: { cta: "Email me when a drawing opens", on: "We'll email you when a drawing opens.", back: "/drawings" },
} as const;

/**
 * One-tap alert switch: the monthly allocated list ("allocated") or DABS
 * drawings ("drawing"). Signed-out visitors go sign in first and land back
 * on the page they came from.
 */
export function AlertSignup({
  kind,
  signedIn,
  optedIn,
}: {
  kind: keyof typeof COPY;
  signedIn: boolean;
  optedIn: boolean;
}) {
  const copy = COPY[kind];
  const [on, setOn] = useState(optedIn);
  const [pending, startTransition] = useTransition();
  const button =
    "inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-center text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto";

  if (!signedIn) {
    return (
      <Link prefetch={false} href={`/login?next=${copy.back}`} className={button}>
        <Bell className="size-4" aria-hidden />
        {copy.cta}
      </Link>
    );
  }

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const result = await setAlertPrefs(kind === "allocated" ? { allocatedEmail: next } : { drawingEmail: next });
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
          {copy.on}
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
      {copy.cta}
    </button>
  );
}

/** "Email me when the list posts": the monthly allocated-list alert. */
export function DropAlertSignup({ signedIn, optedIn }: { signedIn: boolean; optedIn: boolean }) {
  return <AlertSignup kind="allocated" signedIn={signedIn} optedIn={optedIn} />;
}
