"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { groupBySlug, groupCategories, groupOf } from "@/lib/categories";
import { cn } from "@/lib/utils";

const SORTS: [string, string][] = [
  ["", "Best match"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["qty", "Most in stores"],
  ["name", "Name A–Z"],
];

const PRICES: [string, string][] = [
  ["", "Any price"],
  ["15", "Under $15"],
  ["20", "Under $20"],
  ["30", "Under $30"],
  ["50", "Under $50"],
  ["100", "Under $100"],
];

const chip =
  "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3.5 text-sm transition-colors";
const off = "border-border bg-transparent text-foreground hover:border-input";
const on = "border-primary bg-primary/12 text-foreground";

/** Filter bar for search. State lives in the URL, so results are shareable and survive reloads. */
export function SearchControls({ categories }: { categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.push(`/search?${next.toString()}`));
  }

  // Two steps: a broad type ("Vodka", "Red wine"), then a DABS category inside
  // it. Old links carry only ?category=, so the type is derived from it.
  const tree = groupCategories(categories);
  const category = params.get("category") ?? "";
  const group = groupBySlug(params.get("group")) ?? groupOf(category || null);
  const styles = group ? tree.find((t) => t.group.slug === group.slug)?.items ?? [] : [];

  const toggles: [string, string][] = [
    ["instock", "In stock"],
    ["sale", "On sale"],
  ];

  return (
    <div
      className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0", pending && "opacity-70")}
      aria-busy={pending}
    >
      {toggles.map(([key, label]) => {
        const active = params.get(key) === "1";
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => update({ [key]: active ? null : "1" })}
            className={cn(chip, active ? on : off)}
          >
            {active ? <Check className="size-4 text-primary" aria-hidden /> : null}
            {label}
          </button>
        );
      })}
      <ChipSelect
        label="Type"
        value={group?.slug ?? ""}
        display={group?.label}
        onChange={(v) => update({ group: v || null, category: null })}
      >
        <option value="">All types</option>
        {tree.map(({ group: g }) => (
          <option key={g.slug} value={g.slug}>
            {g.label}
          </option>
        ))}
      </ChipSelect>
      {group && styles.length > 1 ? (
        <ChipSelect
          label="Style"
          value={category}
          display={styles.find((s) => s.value === category)?.label}
          onChange={(v) => update({ group: group.slug, category: v || null })}
        >
          <option value="">All {group.label.toLowerCase()}</option>
          {styles.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </ChipSelect>
      ) : null}
      <ChipSelect
        label="Price"
        value={params.get("max") ?? ""}
        display={PRICES.find(([v]) => v && v === params.get("max"))?.[1]}
        onChange={(v) => update({ max: v })}
      >
        {PRICES.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </ChipSelect>
      <ChipSelect label="Sort" value={params.get("sort") ?? ""} onChange={(v) => update({ sort: v })} neutral>
        {SORTS.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </ChipSelect>
    </div>
  );
}

/** A native select dressed as a chip: accessible, and uses the phone's own picker. */
function ChipSelect({
  label,
  value,
  onChange,
  neutral,
  display,
  children,
}: {
  label: string;
  value: string;
  /** The chosen option, shown in the chip so the active filter reads on its own. */
  display?: string;
  onChange: (value: string) => void;
  /** Sort isn't a filter, so it never shows the active style. */
  neutral?: boolean;
  children: React.ReactNode;
}) {
  const active = !neutral && value !== "";
  return (
    <label className={cn(chip, "cursor-pointer pr-2.5", active ? on : off)}>
      <span className={cn(display ? "sr-only" : "text-muted-foreground")}>{label}</span>
      {display ? <span className="max-w-48 truncate">{display}</span> : null}
      <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {children}
      </select>
    </label>
  );
}
