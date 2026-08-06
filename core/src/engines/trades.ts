/**
 * Trade explorer (v2). Surplus on a 1-for-1 is zero-sum, so a pure surplus-max ranking is "sharky"
 * (you win, the partner loses). Roster FIT is NOT zero-sum: each team can improve construction by
 * giving from a position of depth to fill a hole. So the default view surfaces MUTUAL-FIT trades —
 * both teams fill a need from their depth, with a capped (fair) surplus swing. `--sharky` still shows
 * the surplus-max version.
 */
export interface TradePlayer {
  playerId: string;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
  worth: number;
  salary: number;
  surplus: number;
}

export interface SwapSuggestion {
  give: TradePlayer;
  get: TradePlayer;
  myGain: number; // my surplus change (= partner's loss)
  capRelief: number; // cap freed for me (give.salary − get.salary)
  myFillsNeed: boolean; // I get a position I need, from a position of depth
  partnerFillsNeed: boolean; // the partner does too
}

export type TeamNeeds = Record<string, number>; // position -> starterSlots − startable count (>0 = need)

export interface TradeReport {
  myChips: TradePlayer[];
  myDeadWeight: TradePlayer[];
  targets: TradePlayer[];
  myNeeds: { position: string; need: number }[];
  fairSwaps: SwapSuggestion[]; // mutual-fit, capped fairness (default)
  swaps: SwapSuggestion[]; // surplus-max (--sharky)
}

const SKILL = ["QB", "RB", "WR", "TE"];

export function computeTrades(
  all: TradePlayer[],
  myTeamId: number,
  opts: {
    partnerTeamId?: number;
    top?: number;
    maxPerGive?: number;
    rosterPositions?: string[];
    startable?: number;
    fairnessCap?: number;
  } = {},
): TradeReport {
  const top = opts.top ?? 12;
  const maxPerGive = opts.maxPerGive ?? 3;
  const startable = opts.startable ?? 12; // worth ≥ this = a real startable player
  const fairnessCap = opts.fairnessCap ?? 15; // max surplus swing for a "fair" trade
  const slots = startingSlots(opts.rosterPositions ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"]);
  const needs = computeNeeds(all, slots, startable);

  const mine = all.filter((p) => p.teamId === myTeamId);
  const others = all.filter(
    (p) => p.teamId !== myTeamId && (opts.partnerTeamId === undefined || p.teamId === opts.partnerTeamId),
  );

  const myChips = [...mine].filter((p) => p.surplus > 0).sort((a, b) => b.surplus - a.surplus);
  const myDeadWeight = [...mine].filter((p) => p.surplus < 0).sort((a, b) => a.surplus - b.surplus);
  const targets = [...others].filter((p) => p.surplus > 0).sort((a, b) => b.surplus - a.surplus).slice(0, top);

  const myNeed = needs.get(myTeamId) ?? {};
  const myNeeds = SKILL.map((position) => ({ position, need: myNeed[position] ?? 0 })).sort((a, b) => b.need - a.need);

  const swaps: SwapSuggestion[] = [];
  for (const give of mine) {
    for (const get of others) {
      const tol = Math.max(8, 0.3 * Math.max(give.worth, get.worth));
      if (Math.abs(give.worth - get.worth) > tol) continue;
      const myGain = get.surplus - give.surplus;
      if (myGain <= 0) continue;
      const pn = needs.get(get.teamId) ?? {};
      const myFillsNeed = fills(myNeed, get.position, give.position);
      const partnerFillsNeed = fills(pn, give.position, get.position);
      swaps.push({ give, get, myGain, capRelief: give.salary - get.salary, myFillsNeed, partnerFillsNeed });
    }
  }

  const surplusMax = diversify([...swaps].sort((a, b) => b.myGain - a.myGain), maxPerGive, top);

  // Fair = both teams fill a need, real players on both sides, capped surplus swing. Rank by mutual
  // fit then by (capped) benefit to me.
  const fair = swaps
    .filter(
      (s) =>
        s.myFillsNeed &&
        s.partnerFillsNeed &&
        s.give.worth >= startable &&
        s.get.worth >= startable &&
        s.myGain <= fairnessCap,
    )
    .sort((a, b) => b.myGain - a.myGain);
  const fairSwaps = diversify(fair, maxPerGive, top);

  return { myChips, myDeadWeight, targets, myNeeds, fairSwaps, swaps: surplusMax };
}

/**
 * A trade improves my roster if I give from a position of DEPTH (more startable players than starter
 * slots, need<0) and receive at a RELATIVELY THINNER position (higher need). That covers both real
 * shortages (need>0) and depth-for-depth rebalancing (moving a body from a deep spot to a set one) —
 * the everyday "you're stacked at RB, I'm stacked at WR, let's balance" trade.
 */
function fills(need: TeamNeeds, getPos: string, givePos: string): boolean {
  const giveNeed = need[givePos] ?? 0;
  const getNeed = need[getPos] ?? 0;
  return giveNeed < 0 && getNeed > giveNeed;
}

function diversify(sorted: SwapSuggestion[], maxPerGive: number, top: number): SwapSuggestion[] {
  const perGive = new Map<string, number>();
  const out: SwapSuggestion[] = [];
  for (const s of sorted) {
    const n = perGive.get(s.give.playerId) ?? 0;
    if (n >= maxPerGive) continue;
    perGive.set(s.give.playerId, n + 1);
    out.push(s);
    if (out.length >= top) break;
  }
  return out;
}

function computeNeeds(all: TradePlayer[], slots: Record<string, number>, startable: number): Map<number, TeamNeeds> {
  const startableByTeamPos = new Map<number, Record<string, number>>();
  for (const p of all) {
    if (!SKILL.includes(p.position) || p.worth < startable) continue;
    const t = startableByTeamPos.get(p.teamId) ?? {};
    t[p.position] = (t[p.position] ?? 0) + 1;
    startableByTeamPos.set(p.teamId, t);
  }
  const needs = new Map<number, TeamNeeds>();
  for (const teamId of new Set(all.map((p) => p.teamId))) {
    const have = startableByTeamPos.get(teamId) ?? {};
    const need: TeamNeeds = {};
    for (const pos of SKILL) need[pos] = Math.round(((slots[pos] ?? 0) - (have[pos] ?? 0)) * 10) / 10;
    needs.set(teamId, need);
  }
  return needs;
}

/**
 * Base integer starter slots per position (QB/RB/WR/TE), ignoring FLEX. Using base starters keeps
 * "depth" meaningful: a team has tradeable depth at a position only when it has MORE startable players
 * than base starters — the flex fraction would otherwise smear a fake 0.33 need across everyone.
 */
function startingSlots(rosterPositions: string[]): Record<string, number> {
  const slots: Record<string, number> = {};
  for (const pos of rosterPositions) {
    if (SKILL.includes(pos)) slots[pos] = (slots[pos] ?? 0) + 1;
  }
  return slots;
}
