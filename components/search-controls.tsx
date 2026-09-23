"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { STATUS_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";

const SORTS: Record<string, string> = {
  "": "Best match",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  qty: "Most stock",
  name: "Name A–Z",
};

const chip =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors";

/** Filter chips for search. State lives in the URL, so results are shareable. */
export function SearchControls({ categories }: { categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/search?${next.toString()}`);
  }

  const inStock = params.get("instock") === "1";

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        type="button"
        aria-pressed={inStock}
        onClick={() => update("instock", inStock ? null : "1")}
        className={cn(chip, inStock ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground")}
      >
        {inStock ? <Check className="size-4" aria-hidden /> : null}
        In stock only
      </button>
      <ChipSelect
        label="Category"
        value={params.get("category") ?? ""}
        onChange={(v) => update("category", v)}
        options={[["", "All categories"], ...categories.map((c) => [c, c] as [string, string])]}
      />
      <ChipSelect
        label="Status"
        value={params.get("status") ?? ""}
        onChange={(v) => update("status", v)}
        options={[["", "Any status"], ...Object.entries(STATUS_LABELS)]}
      />
      <ChipSelect
        label="Sort"
        value={params.get("sort") ?? ""}
        onChange={(v) => update("sort", v)}
        options={Object.entries(SORTS)}
      />
    </div>
  );
}

/** A native select dressed as a chip: accessible and uses the phone's picker. */
function ChipSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const active = value !== "";
  const current = options.find(([v]) => v === value)?.[1] ?? options[0][1];
  return (
    <label
      className={cn(
        chip,
        "relative cursor-pointer pr-3",
        active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground"
      )}
    >
      <span className="sr-only">{label}: </span>
      <span className="max-w-48 truncate">{current}</span>
      <ChevronDown className="size-4" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
