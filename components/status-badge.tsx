import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";

// Four semantic tones, not nine colors: in-stock (good), watch (allocated/
// limited/soon), clearance (D — limited qty left, the hunter's signal), and
// faded (gone / special-order). Meaning over decoration.
const GOOD = "bg-success-soft text-success border-transparent";
const WATCH = "bg-primary/10 text-primary border-transparent";
const CLEARANCE = "bg-clearance-soft text-clearance border-transparent";
const FADED = "bg-muted text-muted-foreground border-transparent";

const STYLES: Record<string, string> = {
  "1": GOOD,
  A: WATCH,
  L: WATCH,
  P: WATCH,
  T: WATCH,
  U: WATCH,
  D: CLEARANCE,
  X: FADED,
  N: FADED,
  S: FADED,
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn("rounded-md font-semibold", STYLES[status] ?? "")}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
