import { MapPin } from "lucide-react";
import { nearLabel, type Area } from "@/lib/area";
import { checkedAgo, formatQty, unitWord } from "@/lib/format";
import type { Nearby } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** " · checked 5h ago": always shown, since store counts drive where people go. */
function checkedNote(checkedAt: Date | string): string {
  return ` · checked ${checkedAgo(checkedAt)}`;
}

/**
 * "3 stores near Park City · 14 bottles · checked 5h ago". Store-by-store
 * stock refreshes in rotation, so every count says when it was checked
 * (checks older than STORE_DATA_MAX_AGE_HOURS aren't shown at all). Unknown (never checked store
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
