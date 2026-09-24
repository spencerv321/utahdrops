import { GlassMark } from "@/components/glass-mark";
import { cn } from "@/lib/utils";

/** "Utah Drops": the glass mark plus Instrument Serif, with "Drops" set in italic. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <GlassMark className="size-[1.1em] -translate-y-[0.06em] text-foreground" />
      <span className="font-display text-[1.55em] leading-none tracking-[-0.01em]">
        Utah <em className="italic">Drops</em>
      </span>
    </span>
  );
}
