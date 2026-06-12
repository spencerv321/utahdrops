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
    <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Switch
          id="watch-email"
          checked={watch}
          onCheckedChange={(value) => {
            setWatch(value);
            startTransition(async () => {
              await setAlertPrefs({ watchlistEmail: value });
            });
          }}
        />
        <Label htmlFor="watch-email" className="cursor-pointer text-sm">
          Watchlist emails <span className="text-muted-foreground">(hourly digest max)</span>
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="drop-email"
          checked={drops}
          onCheckedChange={(value) => {
            setDrops(value);
            startTransition(async () => {
              await setAlertPrefs({ allocatedEmail: value });
            });
          }}
        />
        <Label htmlFor="drop-email" className="cursor-pointer text-sm">
          Allocated drop alerts <span className="text-muted-foreground">(instant, ~monthly)</span>
        </Label>
      </div>
    </div>
  );
}
