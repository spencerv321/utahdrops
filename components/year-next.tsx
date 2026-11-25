import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DropAlertSignup } from "@/components/drop-alert-signup";

/** The deck's closing panel: turn a shared-link visit into an alert. Not shareable. */
export function YearNext({ signedIn, optedIn, returnTo }: { signedIn: boolean; optedIn: boolean; returnTo: string }) {
  return (
    <section
      aria-labelledby="whats-next-title"
      className="flex aspect-[9/14] w-full flex-col justify-between gap-5 overflow-hidden rounded-xl border border-input bg-raised p-6"
    >
      <p className="text-xs font-semibold tracking-[0.12em] text-subtle-foreground uppercase">What&apos;s next</p>
      <div className="space-y-6">
        <h2 id="whats-next-title" className="font-display text-[2.1rem] leading-[1.02] text-balance">
          Get the next one before it&apos;s gone.
        </h2>
        <div className="space-y-3">
          <p className="text-[15px] leading-snug">
            <span className="font-medium">The allocated drop list.</span>{" "}
            <span className="text-muted-foreground">DABS posts it about a week before each monthly drop. We&apos;ll email it to you.</span>
          </p>
          <DropAlertSignup signedIn={signedIn} optedIn={optedIn} next={returnTo} />
        </div>
        <div className="space-y-1 border-t pt-5">
          <p className="text-[15px] leading-snug">
            <span className="font-medium">Hunting one bottle?</span>{" "}
            <span className="text-muted-foreground">Tap Watch on it and we&apos;ll email you when it&apos;s back in stores. No password.</span>
          </p>
          <Link
            prefetch={false}
            href="/search"
            className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium underline decoration-primary underline-offset-4 hover:text-primary"
          >
            Find a bottle to watch
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <p className="text-xs text-subtle-foreground">Free. Utah Drops is independent, not DABS.</p>
    </section>
  );
}
