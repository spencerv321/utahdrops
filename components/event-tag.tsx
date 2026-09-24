import { cn } from "@/lib/utils";

const TAGS: Record<string, { label: string; className: string }> = {
  restock: { label: "Back in stock", className: "bg-success-soft text-success" },
  new_product: { label: "New", className: "bg-fresh-soft text-fresh" },
  price_drop: { label: "Price drop", className: "bg-price-drop-soft text-price-drop" },
  price_up: { label: "Price up", className: "bg-secondary text-muted-foreground" },
  clearance: { label: "Clearance", className: "bg-clearance-soft text-clearance" },
  allocated: { label: "Now allocated", className: "bg-fresh-soft text-fresh" },
  limited: { label: "Now limited", className: "bg-fresh-soft text-fresh" },
  out_of_stock: { label: "Sold out", className: "bg-secondary text-muted-foreground" },
  allocated_drop: { label: "Drop list", className: "bg-fresh-soft text-fresh" },
};

/** Which tag an inventory event earns (price changes split by direction). */
export function eventTagKey(type: string, detail: Record<string, unknown>): string {
  if (type === "price_change") return Number(detail.new) < Number(detail.old) ? "price_drop" : "price_up";
  if (type === "status_change") {
    if (detail.new === "D") return "clearance";
    if (detail.new === "A") return "allocated";
    if (detail.new === "L") return "limited";
  }
  return type;
}

export function EventTag({ tag }: { tag: string }) {
  const t = TAGS[tag];
  if (!t) return null;
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tracking-[0.06em] uppercase", t.className)}>
      {t.label}
    </span>
  );
}
