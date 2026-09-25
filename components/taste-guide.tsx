"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { TasteRequest } from "@/lib/taste/request";
import { cn } from "@/lib/utils";

const TYPES: [string, string][] = [
  ["any", "Any wine"],
  ["white", "White"],
  ["red", "Red"],
  ["rose", "Rosé"],
  ["sparkling", "Sparkling"],
];
const BUDGETS: [string, string][] = [
  ["any", "Any price"],
  ["15", "Under $15"],
  ["20", "Under $20"],
  ["30", "Under $30"],
  ["50", "Under $50"],
];
const SWEET: [string, string][] = [
  ["any", "No preference"],
  ["dry", "Dry"],
  ["offdry", "Off-dry (a touch sweet)"],
  ["sweet", "Sweet"],
];
const BODY: [string, string][] = [
  ["any", "No preference"],
  ["light", "Light"],
  ["medium", "Medium"],
  ["full", "Full"],
];
const LIKES: [string, string][] = [
  ["crisp", "Crisp"],
  ["fruity", "Fruity"],
  ["oaky", "Oaky"],
  ["floral", "Floral"],
];
const NOVEL: [string, string][] = [
  ["none", "No"],
  ["style", "Less common grape or style"],
  ["scarce", "Harder to find"],
];

const chip =
  "inline-flex min-h-10 cursor-pointer items-center rounded-md border border-border px-3 text-[15px] hover:border-input has-[:checked]:border-primary has-[:checked]:bg-primary/12 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary";

function Choice({ name, options, value }: { name: string; options: [string, string][]; value: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v} className={chip}>
          <input type="radio" name={name} value={v} defaultChecked={v === value} className="sr-only" />
          {label}
        </label>
      ))}
    </div>
  );
}

function Group({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {legend}
        {hint ? <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * "Help me choose": a compact, optional panel that writes the same URL
 * parameters a typed description is read into, and submits to the same
 * /search page. Nothing here is a separate search.
 */
export function TasteGuide({
  areas,
  initial,
  q,
  label = "Help me choose",
  defaultOpen = false,
  className,
}: {
  areas: string[];
  initial?: Partial<TasteRequest>;
  /** Kept when editing a typed search, so name matches stay the same. */
  q?: string;
  label?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel.current?.contains(document.activeElement)) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const max = initial?.maxPrice != null ? String(initial.maxPrice) : "any";
  const budgets = BUDGETS.some(([v]) => v === max) ? BUDGETS : [...BUDGETS, [max, `Under $${max}`] as [string, string]];

  return (
    <div className={cn("space-y-3", className)}>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-input px-3.5 text-[15px] hover:border-primary aria-expanded:border-primary"
      >
        <SlidersHorizontal className="size-4 text-primary" aria-hidden />
        {label}
      </button>
      {open ? (
        <div id={id} ref={panel} className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-medium">Tell us what you like</p>
              <p className="text-sm text-muted-foreground">
                Wine only for now (beta, about 260 everyday wines). Search still covers every bottle.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
              aria-label="Close"
              className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-raised hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <form action="/search" className="space-y-4">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input type="hidden" name="via" value="guided" />
            {/* An empty value clears style words; checked boxes add to it. */}
            <input type="hidden" name="like" value="" />
            <Group legend="Kind of wine">
              <Choice name="wine" options={TYPES} value={initial?.type ?? "any"} />
            </Group>
            <Group legend="Budget" hint="per bottle">
              <Choice name="max" options={budgets} value={max} />
            </Group>
            <Group legend="Sweetness" hint="a preference, not a filter">
              <Choice name="sweet" options={SWEET} value={initial?.sweet ?? "any"} />
            </Group>
            <Group legend="Body" hint="a preference">
              <Choice name="body" options={BODY} value={initial?.body ?? "any"} />
            </Group>
            <Group legend="Also nice" hint="optional">
              <div className="flex flex-wrap gap-2">
                {LIKES.map(([v, text]) => (
                  <label key={v} className={chip}>
                    <input type="checkbox" name="like" value={v} defaultChecked={initial?.tags?.includes(v as never)} className="sr-only" />
                    {text}
                  </label>
                ))}
              </div>
            </Group>
            <Group legend="Something different?">
              <Choice name="novel" options={NOVEL} value={initial?.novelty === "ask" ? "style" : initial?.novelty ?? "none"} />
            </Group>
            <div className="space-y-2">
              <label htmlFor={`${id}-area`} className="text-sm font-medium">
                Where
                <span className="ml-1.5 font-normal text-muted-foreground">only wines on a shelf within 10 miles</span>
              </label>
              <select
                id={`${id}-area`}
                name="area"
                defaultValue={initial?.area && areas.includes(initial.area) ? initial.area : "any"}
                className="block h-11 w-full rounded-md border border-input bg-raised px-3 text-[16px] sm:w-72"
              >
                <option value="any">All of Utah</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    Near {a}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Show wines
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
