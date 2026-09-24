"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { setHomeStores } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { MAX_HOME_STORES } from "@/lib/config";
import { storeLabel } from "@/lib/format";

export interface StoreOption {
  id: number;
  name: string;
  city: string | null;
}

/** Pick up to 3 home stores; watchlist alerts then include "back at <store>". */
export function HomeStores({ stores, selected }: { stores: StoreOption[]; selected: number[] }) {
  const [chosen, setChosen] = useState<number[]>(selected);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(stores.map((s) => [s.id, s]));

  function save(next: number[]) {
    const previous = chosen;
    setChosen(next);
    setError(null);
    startTransition(async () => {
      const result = await setHomeStores(next);
      if (!result.ok) {
        setChosen(previous);
        setError("Couldn't save. Try again.");
      }
    });
  }

  const label = (s: StoreOption) => {
    const l = storeLabel(s.name, s.city);
    return l.number ? `${l.title} (#${l.number})` : l.title;
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-display text-[2rem] leading-none sm:text-4xl">Your stores</h2>
        <p className="text-sm text-muted-foreground">
          Pick up to {MAX_HOME_STORES} stores you shop at. Product pages show them first, and you&apos;ll also
          get an email when a bottle you watch is back at one of them. Statewide alerts keep coming either way.
        </p>
      </div>

      {chosen.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((id) => {
            const s = byId.get(id);
            return (
              <li key={id} className="flex h-10 items-center gap-1 rounded-md bg-raised pr-0.5 pl-3 text-sm">
                {s ? label(s) : `Store ${id}`}
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={`Remove ${s?.name ?? `store ${id}`}`}
                  disabled={pending}
                  onClick={() => save(chosen.filter((c) => c !== id))}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {chosen.length < MAX_HOME_STORES ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const id = Number(pick);
            if (id && !chosen.includes(id)) save([...chosen, id]);
            setPick("");
          }}
        >
          <label htmlFor="home-store" className="sr-only">
            Add a store
          </label>
          <select
            id="home-store"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-11 rounded-md border border-input bg-raised px-3 text-base sm:w-80"
          >
            <option value="">Choose a store…</option>
            {stores
              .filter((s) => !chosen.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {label(s)}
                </option>
              ))}
          </select>
          <Button type="submit" disabled={!pick || pending} className="h-11 rounded-md border border-input bg-transparent px-5 font-medium text-foreground hover:bg-card">
            Add store
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
