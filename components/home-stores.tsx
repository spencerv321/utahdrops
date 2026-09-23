"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { setHomeStores } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { MAX_HOME_STORES } from "@/lib/config";

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
        setError("Couldn't save — try again.");
      }
    });
  }

  const label = (s: StoreOption) => (s.city ? `${s.name} — ${s.city}` : s.name);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">My stores</h2>
        <p className="text-sm text-muted-foreground">
          Pick up to {MAX_HOME_STORES} stores you shop at. When something on your watchlist
          comes back at one of them, your alert says so.
        </p>
      </div>

      {chosen.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((id) => {
            const s = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-1 rounded-full border bg-background py-1 pl-3 pr-1 text-sm">
                {s ? label(s) : `Store ${id}`}
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${s?.name ?? `store ${id}`}`}
                  disabled={pending}
                  onClick={() => save(chosen.filter((c) => c !== id))}
                >
                  <X className="size-3.5" />
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
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm sm:w-80"
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
          <Button type="submit" size="sm" disabled={!pick || pending} className="h-9">
            Add store
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
