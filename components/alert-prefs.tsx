"use client";

import { useState, useTransition } from "react";
import { setAlertPrefs } from "@/app/actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AlertPrefs({
  watchlistEmail,
  allocatedEmail,
  drawingEmail,
}: {
  watchlistEmail: boolean;
  allocatedEmail: boolean;
  drawingEmail: boolean;
}) {
  const [watch, setWatch] = useState(watchlistEmail);
  const [drops, setDrops] = useState(allocatedEmail);
  const [drawings, setDrawings] = useState(drawingEmail);
  const [, startTransition] = useTransition();

  return (
    <div className="divide-y border-y">
      <Row
        id="watch-email"
        title="Watchlist emails"
        hint="When a bottle you watch is back in stores anywhere in Utah (and back at your stores, if you pick them below), sells out, or changes price or status. Changes found in the same check come in one email."
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
        hint="One email a month, when DABS posts the list (we check for it twice a day)."
        checked={drops}
        onChange={(value) => {
          setDrops(value);
          startTransition(async () => {
            await setAlertPrefs({ allocatedEmail: value });
          });
        }}
      />
      <Row
        id="drawing-email"
        title="Drawing alerts"
        hint="When DABS posts or opens a rare-bottle drawing (Pappy, the Antique Collection and others), and the day before it closes when DABS shows the date. A few emails a year; we check about four times a day."
        checked={drawings}
        onChange={(value) => {
          setDrawings(value);
          startTransition(async () => {
            await setAlertPrefs({ drawingEmail: value });
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
    <div className="flex items-center justify-between gap-4 py-4">
      <Label htmlFor={id} className="block cursor-pointer space-y-1">
        <span className="block text-base font-medium">{title}</span>
        <span className="block text-sm font-normal text-muted-foreground">{hint}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="scale-125" />
    </div>
  );
}
