import type { ValueRow } from "./valueSheet";

export interface AdpPlayer {
  name: string;
  position: string;
  team: string;
  adp: number;
}

/**
 * Convert an ADP list into auction dollar values. Players are ranked by ADP; a convex decay curve
 * (studs cost far more than the curve is flat) distributes the league's spendable pool, with a $1
 * floor. This is the "extrapolate auction values from ADP" approach — pure + testable.
 */
export function adpToAuctionValues(
  players: AdpPlayer[],
  opts: { numTeams: number; budget: number; rosterSize?: number; tau?: number } = { numTeams: 12, budget: 200 },
): ValueRow[] {
  const numTeams = opts.numTeams ?? 12;
  const budget = opts.budget ?? 200;
  const rosterSize = opts.rosterSize ?? 15; // draftable slots per team
  const tau = opts.tau ?? 22; // decay scale — smaller = steeper (studs pricier)

  const ranked = [...players].sort((a, b) => a.adp - b.adp);
  const draftable = numTeams * rosterSize; // players that get > $1
  const pool = numTeams * budget; // total money
  const floors = draftable; // $1 minimum for each draftable slot

  // convex weights over the draftable pool
  const weights = ranked.map((_, i) => (i < draftable ? Math.exp(-i / tau) : 0));
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const spendable = Math.max(0, pool - floors);

  return ranked.map((p, i) => {
    const extra = i < draftable ? Math.round((weights[i]! / wSum) * spendable) : 0;
    const value = i < draftable ? 1 + extra : 1;
    return { name: p.name, position: p.position, team: p.team, value };
  });
}
