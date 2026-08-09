// Draft target assistant (#1). PURE.
//
// Given the team you're building (your KEPT set) and the available auction pool, score who to target.
// Blends: positional need (relative to your keepers), player value/tier, a QB-stack bonus (pass-catchers
// on your kept QB's NFL team), and a diversity penalty (don't over-concentrate one NFL team). The web
// mirrors this scoring for the static site — keep the two in sync.

const SKILL = ["QB", "RB", "WR", "TE"];

export interface TargetCandidate {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  worth: number;
  tier: number | null;
  ownerTeamId: number | null; // null = free agent
  projectedKeeper: boolean; // rostered AND worth ≥ keeper cost (likely retained → not in the auction)
}

export interface ScoredTarget extends TargetCandidate {
  score: number;
  reasons: string[];
  fillsNeed: boolean;
  stack: boolean;
  overStacked: boolean;
}

export interface TargetInputs {
  candidates: TargetCandidate[]; // the available pool (already filtered to gettable players)
  needs: Record<string, number>; // my positional need (starterSlots − kept startable); >0 = short
  keptQbs: { name: string; nflTeam: string | null }[]; // my kept QBs (for stacks)
  teamCounts: Record<string, number>; // count of my kept players per NFL team
  limit?: number;
}

/**
 * Positional need from a KEPT set: starterSlots − kept players at each skill position. Counts every kept
 * player at the position (regardless of worth) — if you're keeping a QB, your QB slot is filled even if a
 * value source prices him cheaply (ADP undervalues QBs). Pure.
 */
export function positionalNeeds(
  kept: { position: string }[],
  starterSlots: Record<string, number>,
): Record<string, number> {
  const have: Record<string, number> = {};
  for (const p of kept) if (SKILL.includes(p.position)) have[p.position] = (have[p.position] ?? 0) + 1;
  const need: Record<string, number> = {};
  for (const pos of SKILL) need[pos] = (starterSlots[pos] ?? 0) - (have[pos] ?? 0);
  return need;
}

/** Score + rank auction targets. Pure. */
export function computeDraftTargets(input: TargetInputs): ScoredTarget[] {
  const { candidates, needs, keptQbs, teamCounts } = input;
  const qbTeams = new Set(keptQbs.map((q) => q.nflTeam).filter(Boolean) as string[]);

  const scored: ScoredTarget[] = candidates.map((c) => {
    const need = needs[c.position] ?? 0;
    const fillsNeed = need > 0;
    const stack = (c.position === "WR" || c.position === "TE") && !!c.nflTeam && qbTeams.has(c.nflTeam);
    const conc = c.nflTeam ? teamCounts[c.nflTeam] ?? 0 : 0;
    const overStacked = conc >= 2;

    // Value is the base; need boosts (up to +50% for a 2-deep hole), depth dampens; stack/diversity adjust.
    let score = c.worth * (fillsNeed ? 1 + 0.25 * Math.min(need, 2) : 0.6);
    if (stack) score += 0.15 * c.worth;
    if (overStacked) score -= 0.12 * c.worth;

    const reasons: string[] = [];
    reasons.push(fillsNeed ? `fills ${c.position} need` : `depth at ${c.position}`);
    if (stack) reasons.push(`stacks with ${keptQbs.find((q) => q.nflTeam === c.nflTeam)?.name ?? "your QB"}`);
    if (overStacked) reasons.push(`⚠ ${conc} kept from ${c.nflTeam}`);
    if (c.tier) reasons.push(`${c.position} tier ${c.tier}`);

    return { ...c, score: Math.round(score * 10) / 10, reasons, fillsNeed, stack, overStacked };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 40);
}
