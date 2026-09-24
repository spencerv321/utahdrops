"use client";

import { useState, useTransition } from "react";
import { setAlertPrefs } from "@/app/actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AlertPrefs({
  watchlistEmail,
  allocatedEmail,
}: {
  watchlistEmail: boolean;
  allocatedEmail: boolean;
}) {
  const [watch, setWatch] = useState(watchlistEmail);
  const [drops, setDrops] = useState(allocatedEmail);
  const [, startTransition] = useTransition();

  return (
    <div className="divide-y rounded-2xl border bg-card">
      <Row
        id="watch-email"
        title="Watchlist emails"
        hint="When a bottle you watch is back in stock (or back at your store), sells out, or changes price or status. At most one email an hour."
        checked={watch}
        onChange={(value) => {
          setWatch(value);
          startTransition(async () => {
            await setAlertPrefs({ watchlistEmail: value });
          });
        }}
      />
      <Row
        id="drop-email"
        title="Allocated drop alerts"
        hint="One email a month, the moment DABS posts the list."
        checked={drops}
        onChange={(value) => {
          setDrops(value);
          startTransition(async () => {
            await setAlertPrefs({ allocatedEmail: value });
          });
        }}
      />
    </div>
  );
}

function Row({
  id,
  title,
  hint,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <Label htmlFor={id} className="block cursor-pointer space-y-1">
        <span className="block text-base font-bold">{title}</span>
        <span className="block text-sm font-normal text-muted-foreground">{hint}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="scale-125" />
    </div>
  );
}
