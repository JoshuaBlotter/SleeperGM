import type { LeagueRules } from "../config/league-rules";
import { leagueRules, rookieBaseCost } from "../config/league-rules";
import type { Provenance } from "../types";

export interface KeeperCost {
  base: number; // origin salary basis (auction $, FAAB bid, or rookie-table salary)
  cost: number; // keeper salary for the upcoming season
  isPlaceholder: boolean;
}

/** Origin (pre-escalation) salary basis for a player. */
export function baseSalary(
  prov: Provenance,
  position: string,
  rules: LeagueRules = leagueRules,
): { base: number; isPlaceholder: boolean } {
  if (prov.acquiredVia === "rookie" && prov.rookiePick) {
    return { base: rookieBaseCost(prov.rookiePick.slot, position, rules), isPlaceholder: rules.rookieCost.placeholder };
  }
  return { base: prov.acquisitionCost, isPlaceholder: false };
}

/** The single-season salary increase (§6.1). Skill: posBase + yearsKept-in-stint. K/DEF: flat. */
export function yearIncrement(position: string, yearsKeptInStint: number, rules: LeagueRules = leagueRules): number {
  const esc = rules.keeperEscalation;
  const posBase = esc.positionalBase[position];
  if (esc.flatPositions.includes(position) || posBase === undefined) return esc.flatIncrease;
  return posBase + yearsKeptInStint;
}

/**
 * Replay the salary from its origin to `throughSeason`. The salary ACCUMULATES across owners
 * (a trade carries the running salary), while the years-kept term RESETS at each ownership change.
 * `stintStarts` are the seasons a (new) owner took possession, including the origin season.
 */
export function accumulatedSalary(opts: {
  originSeason: number;
  originCost: number;
  position: string;
  stintStarts: number[];
  throughSeason: number;
  rules?: LeagueRules;
}): number {
  const rules = opts.rules ?? leagueRules;
  const starts = [...new Set(opts.stintStarts)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  let salary = opts.originCost;
  for (let year = opts.originSeason + 1; year <= opts.throughSeason; year++) {
    let stintStart = opts.originSeason;
    for (const s of starts) if (s < year) stintStart = s;
    salary += yearIncrement(opts.position, year - stintStart, rules);
  }
  return Math.max(rules.keeperEscalation.floor, Math.round(salary));
}

/**
 * Convenience: keeper salary for the upcoming season.
 * Pass `stintStarts` (from ownership history) to carry accumulated salary through trades;
 * omit for a single-owner replay from the origin season.
 */
export function keeperCostNextYear(
  prov: Provenance,
  position: string,
  opts: { throughSeason: number; stintStarts?: number[]; rules?: LeagueRules },
): KeeperCost {
  const rules = opts.rules ?? leagueRules;
  const { base, isPlaceholder } = baseSalary(prov, position, rules);
  const originSeason = Number(prov.acquisitionSeason);
  const cost = accumulatedSalary({
    originSeason,
    originCost: base,
    position,
    stintStarts: opts.stintStarts ?? [originSeason],
    throughSeason: opts.throughSeason,
    rules,
  });
  return { base, cost, isPlaceholder };
}
