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

export interface SalaryReplayOpts {
  originSeason: number;
  originCost: number;
  position: string;
  stintStarts: number[];
  throughSeason: number;
  rules?: LeagueRules;
}

/** One season of the replay: the salary carried into it, and what was added to get there. */
export interface SalaryYear {
  season: number;
  salary: number;
  increase: number | null; // null in the origin season — nothing was added, it IS the origin cost
  newOwner: boolean; // this season starts a new stint, so the years-kept term resets
}

/**
 * Replay the salary from its origin to `throughSeason`, one season at a time. The salary ACCUMULATES
 * across owners (a trade carries the running salary), while the years-kept term RESETS at each
 * ownership change. `stintStarts` are the seasons a (new) owner took possession, including the origin.
 *
 * The year-by-year form is what the history views show (#19/#20); `accumulatedSalary` is just its
 * last row, so the ledger a manager reads and the cost the cap engine charges can never disagree.
 */
export function salarySchedule(opts: SalaryReplayOpts): SalaryYear[] {
  const rules = opts.rules ?? leagueRules;
  const floor = rules.keeperEscalation.floor;
  // A missing origin season arrives as 0 (Number(null)), which is finite — guard on the range so a
  // bad provenance can't allocate two thousand rows of escalation.
  if (!Number.isFinite(opts.originSeason) || opts.originSeason < 1900) return [];
  const starts = [...new Set(opts.stintStarts)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);

  let salary = opts.originCost;
  const out: SalaryYear[] = [
    { season: opts.originSeason, salary: Math.max(floor, Math.round(salary)), increase: null, newOwner: true },
  ];
  for (let year = opts.originSeason + 1; year <= opts.throughSeason; year++) {
    let stintStart = opts.originSeason;
    for (const s of starts) if (s < year) stintStart = s;
    const increase = yearIncrement(opts.position, year - stintStart, rules);
    salary += increase;
    out.push({ season: year, salary: Math.max(floor, Math.round(salary)), increase, newOwner: starts.includes(year) });
  }
  return out;
}

/** Convenience: where the replay lands — the salary in `throughSeason`. */
export function accumulatedSalary(opts: SalaryReplayOpts): number {
  const rules = opts.rules ?? leagueRules;
  const schedule = salarySchedule(opts);
  return schedule[schedule.length - 1]?.salary ?? Math.max(rules.keeperEscalation.floor, Math.round(opts.originCost));
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
