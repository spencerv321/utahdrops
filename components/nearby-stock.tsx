import { MapPin } from "lucide-react";
import { nearLabel, type Area } from "@/lib/area";
import { formatQty, unitWord } from "@/lib/format";
import type { Nearby } from "@/lib/queries";
import { cn } from "@/lib/utils";

const MT = "America/Denver";

/** " · checked Sep 21" when the store-by-store check is over a day and a half old. */
function checkedNote(checkedAt: Date | string): string {
  const d = new Date(checkedAt);
  if (Date.now() - d.getTime() <= 36 * 3600_000) return "";
  return ` · checked ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: MT })}`;
}

/**
 * "3 stores near Park City · 14 bottles". Store-by-store stock refreshes in
 * rotation, so an older check says when it was. Unknown (never checked store
 * by store) renders nothing rather than a false "none".
 */
export function NearbyStock({
  area,
  nearby,
  category,
  sizeMl,
  className,
}: {
  area: Area | null | undefined;
  nearby: Nearby | undefined;
  category: string | null;
  sizeMl: number | null;
  className?: string;
}) {
  if (!area || !nearby) return null;
  const where = nearLabel(area);
  const when = checkedNote(nearby.checkedAt);
  return (
    <span className={cn("inline-flex items-center gap-1", nearby.stores > 0 ? "font-medium text-foreground" : "text-muted-foreground", className)}>
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      {nearby.stores > 0
        ? `${nearby.stores} ${nearby.stores === 1 ? "store" : "stores"} ${where} · ${formatQty(nearby.units)} ${unitWord(category, sizeMl, nearby.units)}`
        : `None ${where}`}
      {when ? <span className="font-normal text-subtle-foreground">{when}</span> : null}
    </span>
  );
}
