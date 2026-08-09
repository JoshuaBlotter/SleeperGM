// Tier board builder (#4). PURE.
//
// A flat value ranking hides tier cliffs. Draft by tier, not rank: a $2 gap between the #5 and #6 QB
// barely matters, but a $15 cliff is where a tier ends. This gap-clusters players by projected value —
// a new tier starts when the drop to the next player is large relative to their value. That lifts Josh
// Allen above the QB pack and groups Trey McBride with elite WRs in the cross-position view.

export interface TierPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  value: number;
}

export interface Tier {
  tier: number; // 1 = best
  label: string; // "Elite" for tier 1, else "Tier N"
  minValue: number;
  maxValue: number;
  players: TierPlayer[];
}

export interface TierOptions {
  gapPct?: number; // a new tier starts when the drop >= gapPct × the previous player's value...
  absBreak?: number; // ...but never require more than this many $ (so smooth high-value curves still split)
  minGap?: number; // ...and the drop must clear this floor (so cheap tails don't over-split)
  limit?: number; // only tier the top N by value (draft-relevant)
}

function makeTier(tier: number, players: TierPlayer[]): Tier {
  const vals = players.map((p) => p.value);
  return { tier, label: tier === 1 ? "Elite" : `Tier ${tier}`, minValue: Math.min(...vals), maxValue: Math.max(...vals), players };
}

// Fixed $ bands for the cross-position view (lower bounds, descending). Gap-clustering can't split a
// dense mixed-position list, so cross-position grouping uses these bands instead — a player lands beside
// everyone in the same price range regardless of position (McBride $20 sits with the $14–21 WRs/RBs).
const BAND_EDGES = [60, 45, 32, 22, 14, 8];

/** Bucket players into fixed $ bands (draft-relevant: below the lowest edge is dropped). Pure. */
export function bandize(players: TierPlayer[], edges: number[] = BAND_EDGES): Tier[] {
  const sorted = [...players].sort((a, b) => b.value - a.value);
  const buckets: TierPlayer[][] = edges.map(() => []);
  for (const p of sorted) {
    const i = edges.findIndex((lo) => p.value >= lo);
    if (i >= 0) buckets[i]!.push(p);
  }
  const out: Tier[] = [];
  edges.forEach((lo, i) => {
    const players = buckets[i]!;
    if (!players.length) return;
    const hi = i === 0 ? Infinity : edges[i - 1]! - 1;
    const label = hi === Infinity ? `$${lo}+` : `$${lo}–${hi}`;
    const vals = players.map((p) => p.value);
    out.push({ tier: out.length + 1, label, minValue: Math.min(...vals), maxValue: Math.max(...vals), players });
  });
  return out;
}

/** Gap-cluster players into value tiers (highest first). Pure. */
export function tierize(players: TierPlayer[], opts: TierOptions = {}): Tier[] {
  const gapPct = opts.gapPct ?? 0.2;
  const absBreak = opts.absBreak ?? 6;
  const minGap = opts.minGap ?? 2;
  const sorted = [...players].sort((a, b) => b.value - a.value).slice(0, opts.limit ?? players.length);

  const tiers: Tier[] = [];
  let cur: TierPlayer[] = [];
  for (const p of sorted) {
    const prev = cur[cur.length - 1];
    if (prev) {
      const drop = prev.value - p.value;
      // Break on a big relative gap, but cap the required gap at absBreak $ so smooth high-value
      // stretches (e.g. the top RBs) still split into tiers instead of one giant group.
      const required = Math.max(minGap, Math.min(gapPct * prev.value, absBreak));
      if (drop >= required) {
        tiers.push(makeTier(tiers.length + 1, cur));
        cur = [];
      }
    }
    cur.push(p);
  }
  if (cur.length) tiers.push(makeTier(tiers.length + 1, cur));
  return tiers;
}
