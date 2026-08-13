import type { ValueRow } from "./valueSheet";

export interface AdpPlayer {
  name: string;
  position: string;
  team: string;
  adp: number;
}

// The rank -> dollars curve, fitted to ESPN's published auction values (its stock 10-team PPR league,
// 160 priced players). A plain exponential can't fit that curve: the head is nearly FLAT (ESPN's #1 is
// $57 and its #11 is $48) and then the tail collapses hard ($2 by rank 100). A stretched exponential,
// exp(-(i/tau)^SHAPE) with SHAPE > 1, does both — it reproduces ESPN's board to within ~$1 at every
// tenth rank. `tau` scales with the draftable pool, so a deeper league stretches the same shape.
//
// The old curve was exp(-i/22): it charged $100 for the #1 pick out of a $200 budget and flattened
// 139 of 256 players to $1, which threw away all rank information below about pick 130 — the reason a
// "top 12 at the position" list could come back full of $1 ties in arbitrary order (#18).
const SHAPE = 1.33;
const TAU_PER_SLOT = 0.225; // 36 / 160, from the ESPN fit

/**
 * Convert an ADP list into auction dollar values. Players are ranked by ADP; the fitted decay curve
 * above distributes the league's spendable pool, with a $1 floor. This is the "extrapolate auction
 * values from ADP" approach — pure + testable.
 */
export function adpToAuctionValues(
  players: AdpPlayer[],
  opts: { numTeams: number; budget: number; rosterSize?: number; tau?: number; shape?: number } = { numTeams: 12, budget: 200 },
): ValueRow[] {
  const numTeams = opts.numTeams ?? 12;
  const budget = opts.budget ?? 200;
  const rosterSize = opts.rosterSize ?? 15; // draftable slots per team

  const ranked = [...players].sort((a, b) => a.adp - b.adp);
  const draftable = numTeams * rosterSize; // players that get > $1
  const pool = numTeams * budget; // total money
  const floors = draftable; // $1 minimum for each draftable slot
  const tau = opts.tau ?? TAU_PER_SLOT * draftable; // decay scale — smaller = steeper (studs pricier)
  const shape = opts.shape ?? SHAPE;

  // fitted weights over the draftable pool
  const weights = ranked.map((_, i) => (i < draftable ? Math.exp(-((i / tau) ** shape)) : 0));
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const spendable = Math.max(0, pool - floors);

  return ranked.map((p, i) => {
    const extra = i < draftable ? Math.round((weights[i]! / wSum) * spendable) : 0;
    const value = i < draftable ? 1 + extra : 1;
    return { name: p.name, position: p.position, team: p.team, value };
  });
}
