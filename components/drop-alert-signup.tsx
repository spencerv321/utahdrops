"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { setAlertPrefs } from "@/app/actions";

const button =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-colors disabled:opacity-70";

/** "Email me when the list posts": the monthly drop alert toggle (sits on the brand hero). */
export function DropAlertSignup({ signedIn, optedIn }: { signedIn: boolean; optedIn: boolean }) {
  const [on, setOn] = useState(optedIn);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link href="/login?next=/drops" className={`${button} bg-gold text-gold-foreground`}>
        <Bell className="size-[18px]" aria-hidden />
        Email me when the list posts
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        className={on ? `${button} border-2 border-brand-foreground/50 text-brand-foreground` : `${button} bg-gold text-gold-foreground`}
        onClick={() => {
          const next = !on;
          setOn(next);
          startTransition(async () => {
            const result = await setAlertPrefs({ allocatedEmail: next });
            if (!result.ok) {
              setOn(!next);
              toast.error("Couldn't save that. Try again.");
            }
          });
        }}
      >
        {on ? <BellOff className="size-[18px]" aria-hidden /> : <Bell className="size-[18px]" aria-hidden />}
        {on ? "Turn off drop alerts" : "Email me when the list posts"}
      </button>
      <p className="text-center text-sm text-brand-muted">
        {on ? "You're set: one email the moment the list posts." : "One email a month, the moment the list posts."}
      </p>
    </div>
  );
}
