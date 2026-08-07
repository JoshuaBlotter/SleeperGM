// Client-side manual value overrides, persisted in localStorage (this browser only). These let you
// say "I think this player is worth $X" without rebuilding the snapshot. They overlay the active value
// source on the Team keeper board (worth → surplus → recommendation recompute live). League-wide
// Inflation and Trades use the baked snapshot values — re-snapshot (or edit config/values/overrides.csv)
// to make an override affect those too.

import { useEffect, useState } from "react";

const KEY = "sgm.overrides.v1";
export type OverrideMap = Record<string, number>;

function read(): OverrideMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: OverrideMap = {};
    for (const [k, v] of Object.entries(obj)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function write(o: OverrideMap) {
  localStorage.setItem(KEY, JSON.stringify(o));
  window.dispatchEvent(new Event("sgm-overrides")); // notify other components in this tab
}

export function setOverride(playerId: string, value: number) {
  const o = read();
  o[playerId] = value;
  write(o);
}

export function clearOverride(playerId: string) {
  const o = read();
  delete o[playerId];
  write(o);
}

export function clearAllOverrides() {
  write({});
}

/** Subscribe to the override map (updates on edits in this tab and storage events from other tabs). */
export function useOverrides(): OverrideMap {
  const [o, setO] = useState<OverrideMap>(read);
  useEffect(() => {
    const h = () => setO(read());
    window.addEventListener("sgm-overrides", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("sgm-overrides", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return o;
}

/** Same thresholds as core/engines/surplus.ts recommendation() — kept in sync by hand (2 lines). */
export function recommendation(surplus: number, worth: number): "keep" | "hold" | "cut" {
  if (surplus >= 5) return "keep";
  if (surplus <= -5 || worth <= 1) return "cut";
  return "hold";
}
