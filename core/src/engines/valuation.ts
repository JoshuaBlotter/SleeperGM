import type { PlayerLite, ValueLine } from "../types";

export interface ValuationInputs {
  pointsByPlayer: Map<string, number>;
  meta: Map<string, PlayerLite>; // playerId -> position
  rosterPositions: string[]; // league roster_positions (starters + BN + FLEX ...)
  numTeams: number;
  budget: number; // per-team auction budget
  streamerValues?: Record<string, number>; // positions valued at market (~free) -> flat worth
}

const FLEX_POOL = ["RB", "WR", "TE"] as const;
const DEFAULT_STREAMER_VALUES: Record<string, number> = { K: 1, DEF: 2 };

/**
 * v1 VORP -> auction-dollars model (spec §7). Uses realized points as the projection proxy.
 *
 * K and DEF are "streamer" positions: despite scoring plenty of points, the market pays ~nothing for
 * them (replacement is free off waivers). So they get a flat `streamerValue` and are excluded from the
 * dollar pool — which the skill positions (QB/RB/WR/TE) then absorb, matching how auctions really spend.
 */
export function valuePlayers(inp: ValuationInputs): Map<string, ValueLine> {
  const streamerValues = inp.streamerValues ?? DEFAULT_STREAMER_VALUES;
  const streamers = new Set(Object.keys(streamerValues));
  const streamerValueOf = (pos: string) => streamerValues[pos] ?? 1;
  const startSlots = countStartingSlots(inp.rosterPositions);

  // group skill points by position (streamers excluded from the pool math)
  const byPos = new Map<string, { id: string; pts: number }[]>();
  for (const [id, pts] of inp.pointsByPlayer) {
    const pos = inp.meta.get(id)?.position ?? "?";
    if (streamers.has(pos)) continue;
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push({ id, pts });
  }
  for (const arr of byPos.values()) arr.sort((a, b) => b.pts - a.pts);

  // replacement points per skill position
  const replacement = new Map<string, number>();
  for (const [pos, arr] of byPos) {
    const slots = startSlots[pos] ?? 0;
    const rank = Math.max(1, Math.round(inp.numTeams * slots));
    const idx = Math.min(arr.length - 1, rank);
    replacement.set(pos, arr[idx]?.pts ?? 0);
  }

  // points above replacement (skill only)
  const par = new Map<string, number>();
  let totalPar = 0;
  for (const [pos, arr] of byPos) {
    const repl = replacement.get(pos) ?? 0;
    for (const { id, pts } of arr) {
      const v = Math.max(0, pts - repl);
      par.set(id, v);
      totalPar += v;
    }
  }

  // reserve streamer money (per-position), then distribute the rest across skill PAR ($1 min/skill starter)
  const skillSlots = sumSlots(startSlots, (pos) => !streamers.has(pos));
  let reservedStreamers = 0;
  for (const [pos, slots] of Object.entries(startSlots)) if (streamers.has(pos)) reservedStreamers += inp.numTeams * slots * streamerValueOf(pos);
  const pool = inp.numTeams * inp.budget - reservedStreamers - inp.numTeams * skillSlots;
  const dollarsPerPoint = totalPar > 0 ? pool / totalPar : 0;

  const out = new Map<string, ValueLine>();
  for (const [id, pts] of inp.pointsByPlayer) {
    const pos = inp.meta.get(id)?.position ?? "?";
    const points = Math.round(pts * 10) / 10;
    if (streamers.has(pos)) {
      out.set(id, { playerId: id, points, par: 0, value: streamerValueOf(pos) });
      continue;
    }
    const p = par.get(id) ?? 0;
    const value = p > 0 ? Math.max(1, Math.round(1 + p * dollarsPerPoint)) : 1;
    out.set(id, { playerId: id, points, par: Math.round(p * 10) / 10, value });
  }
  return out;
}

function countStartingSlots(rosterPositions: string[]): Record<string, number> {
  const slots: Record<string, number> = {};
  let flex = 0;
  for (const pos of rosterPositions) {
    if (pos === "BN" || pos === "IR" || pos === "TAXI") continue;
    if (pos === "FLEX" || pos === "WRRB_FLEX" || pos === "REC_FLEX" || pos === "SUPER_FLEX") {
      flex++;
      continue;
    }
    slots[pos] = (slots[pos] ?? 0) + 1;
  }
  if (flex > 0) {
    const share = flex / FLEX_POOL.length;
    for (const pos of FLEX_POOL) slots[pos] = (slots[pos] ?? 0) + share;
  }
  return slots;
}

function sumSlots(slots: Record<string, number>, pred: (pos: string) => boolean): number {
  let n = 0;
  for (const [pos, v] of Object.entries(slots)) if (pred(pos)) n += v;
  return n;
}
