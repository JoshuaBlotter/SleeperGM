// Per-player salary history (#19) and the season-over-season ledger it feeds (#20). PURE.
//
// A keeper salary is a running total: it starts at a priced event Sleeper records (an auction bid, a
// FAAB bid, a rookie pick's table salary) and then escalates every offseason the player is kept. The
// app only ever showed the two ends of that — "acquired for $12" and "keep for $31" — so there was no
// way for a manager to check the middle, which is exactly what a keeper league argues about.
//
// This lays the whole chain out, one row per season, and marks where each number came from:
//   sleeper  — the origin event, straight off the draft/transaction record
//   computed — a replayed escalation year
//   sheet    — anchored to the commissioner's salary sheet (and every year after it)
// A replayed year that the sheet later contradicts is flagged `approximate`, so a disagreement shows
// up as a disagreement instead of being quietly smoothed over.

import { leagueRules, type LeagueRules } from "../config/league-rules";
import type { AcquiredVia, Provenance } from "../types";
import { baseSalary, salarySchedule, yearIncrement } from "./keepers";

export type SalaryEvent = AcquiredVia | "kept" | "traded";

export interface SalarySeason {
  season: string;
  salary: number; // the salary the player carried in that season
  event: SalaryEvent;
  increase: number | null; // escalation added since the previous season (null at the origin)
  note: string | null; // e.g. "R1.04" for a rookie pick
  source: "sleeper" | "computed" | "sheet";
  approximate: boolean; // a replayed year the salary sheet goes on to contradict
}

/** The commissioner's sheet row for this player, if there is one. */
export interface SalaryAnchor {
  season: number;
  salary: number;
  yearsKept: number | null;
}

export interface SalaryLadderOpts {
  provenance: Provenance;
  position: string;
  /** Seasons a (new) owner took possession, including the origin — a trade carries the running salary. */
  stintStarts: number[];
  throughSeason: number;
  anchor?: SalaryAnchor;
  rules?: LeagueRules;
}

/**
 * Every season of a player's salary, oldest first, ending in `throughSeason`.
 *
 * The replay runs from the origin regardless; if there's a sheet anchor, the anchor season and every
 * season after it are re-derived from the sheet number instead (matching what the cap engine charges),
 * and the replayed years before it are marked approximate when the two disagree at the anchor.
 */
export function salaryLadder(opts: SalaryLadderOpts): SalarySeason[] {
  const rules = opts.rules ?? leagueRules;
  const { provenance: prov, position } = opts;
  // `acquiredVia: "unknown"` carries a null season, and Number(null) is 0 — which is finite, and would
  // replay two thousand years of escalation. There is no ladder to show for a player with no origin.
  const originSeason = prov.acquisitionSeason ? Number(prov.acquisitionSeason) : NaN;
  if (!Number.isFinite(originSeason)) return [];

  const { base } = baseSalary(prov, position, rules);
  const replay = salarySchedule({
    originSeason,
    originCost: base,
    position,
    stintStarts: opts.stintStarts,
    throughSeason: opts.throughSeason,
    rules,
  });

  const rows: SalarySeason[] = replay.map((y, i) => ({
    season: String(y.season),
    salary: y.salary,
    event: i === 0 ? prov.acquiredVia : y.newOwner ? "traded" : "kept",
    increase: y.increase,
    note: i === 0 ? originNote(prov) : null,
    source: i === 0 ? "sleeper" : "computed",
    approximate: false,
  }));

  const anchor = opts.anchor;
  if (!anchor || anchor.season < originSeason) return rows;

  // Re-derive from the sheet: the anchor season is authoritative, later years escalate off it.
  const disagrees = rows.find((r) => r.season === String(anchor.season))?.salary !== anchor.salary;
  for (const r of rows) if (Number(r.season) < anchor.season) r.approximate = disagrees;

  let salary = anchor.salary;
  let yearsKept = anchor.yearsKept ?? Math.max(0, anchor.season - currentStintStart(opts.stintStarts, anchor.season));
  for (let year = anchor.season; year <= opts.throughSeason; year++) {
    let increase: number | null = null;
    if (year > anchor.season) {
      yearsKept += 1;
      increase = yearIncrement(position, yearsKept, rules);
      salary += increase;
    }
    const at = rows.findIndex((r) => r.season === String(year));
    const row: SalarySeason = {
      // Keep whatever the replay knew about the season (the origin event, or a trade); only the
      // dollars and their provenance change.
      ...(rows[at] ?? { season: String(year), event: "kept" as SalaryEvent, note: null }),
      season: String(year),
      salary: Math.max(rules.keeperEscalation.floor, Math.round(salary)),
      increase,
      source: "sheet",
      approximate: false,
    };
    if (at >= 0) rows[at] = row;
    else rows.push(row);
  }
  return rows.sort((a, b) => Number(a.season) - Number(b.season));
}

/**
 * Only used when the sheet omits `years_kept` (it doesn't, in practice): the CURRENT owner's tenure
 * start — the latest stint — so a traded player's escalation term restarts, same as the cap engine.
 */
function currentStintStart(stintStarts: number[], fallback: number): number {
  const finite = stintStarts.filter((n) => Number.isFinite(n));
  return finite.length ? Math.max(...finite) : fallback;
}

/** "R1.04" for a rookie pick; nothing to add for a priced event — the dollar already says it. */
function originNote(prov: Provenance): string | null {
  if (prov.acquiredVia !== "rookie" || !prov.rookiePick) return null;
  return `R${prov.rookiePick.round}.${String(prov.rookiePick.slot).padStart(2, "0")}`;
}
