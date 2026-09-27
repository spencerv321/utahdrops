"use client";

import { useEffect } from "react";
import { markUntracked } from "@/lib/beacon";

/** Marks this browser untracked (an admin or test account used it). Renders nothing. */
export function NoTrack() {
  useEffect(() => markUntracked(), []);
  return null;
}
