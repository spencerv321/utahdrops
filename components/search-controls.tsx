"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { categoryLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const SORTS: [string, string][] = [
  ["", "In stock first"],
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

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/search?${next.toString()}`));
  }

  // Category groups ("Whiskey", "Red wine", …) for a scannable native picker.
  const groups = new Map<string, string[]>();
  for (const c of categories) {
    const head = categoryLabel(c).split(" · ")[0];
    groups.set(head, [...(groups.get(head) ?? []), c]);
  }

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
            onClick={() => update(key, active ? null : "1")}
            className={cn(chip, active ? on : off)}
          >
            {active ? <Check className="size-4 text-primary" aria-hidden /> : null}
            {label}
          </button>
        );
      })}
      <ChipSelect label="Category" value={params.get("category") ?? ""} onChange={(v) => update("category", v)}>
        <option value="">All categories</option>
        {[...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([head, list]) => (
            <optgroup key={head} label={head}>
              {list.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c).split(" · ").slice(1).join(" · ") || head}
                </option>
              ))}
            </optgroup>
          ))}
      </ChipSelect>
      <ChipSelect label="Price" value={params.get("max") ?? ""} onChange={(v) => update("max", v)}>
        {PRICES.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </ChipSelect>
      <ChipSelect label="Sort" value={params.get("sort") ?? ""} onChange={(v) => update("sort", v)} neutral>
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
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Sort isn't a filter, so it never shows the active style. */
  neutral?: boolean;
  children: React.ReactNode;
}) {
  const active = !neutral && value !== "";
  return (
    <label className={cn(chip, "cursor-pointer pr-2.5", active ? on : off)}>
      <span className="text-muted-foreground">{label}</span>
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
