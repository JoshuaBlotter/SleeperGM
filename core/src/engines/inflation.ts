import { leagueRules } from "../config/league-rules";

/**
 * League auction inflation, the way this league actually experiences it:
 * cheap keepers leave surplus cap in the economy, which chases a smaller pool of available players.
 *
 * For each rostered player we compare market `worth` to keeper `salary`. A rational GM keeps anyone
 * with positive surplus (worth > salary); those dollars-of-value are locked up cheaply. The unspent
 * surplus (worth − salary, summed over all keepers) is the extra money that inflates the auction:
 *
 *   multiplier = auctionMoney / auctionValue
 *              = (capTotal − keeperSalaries) / (capTotal − keeperWorth)
 *              = 1 + keeperSurplus / auctionValue
 *
 * The valuation is already calibrated to the cap (its pool = numTeams × budget), so worth and money
 * are on one scale; `calibration` = capTotal / Σworth reports how close that holds for the rostered set.
 */
export interface InflationPlayer {
  name: string;
  position: string;
  teamId: number;
  teamName: string;
  worth: number;
  salary: number;
}

export interface TeamSurplus {
  teamId: number;
  teamName: string;
  keptCount: number;
  salaries: number;
  worth: number;
  surplus: number;
}

export interface DiscountLine extends InflationPlayer {
  surplus: number;
}

export interface InflationResult {
  capTotal: number;
  numTeams: number;
  calibration: number; // worth-normalization factor (≈1 when valuation matches the cap)
  keptCount: number;
  releasedCount: number;
  keeperSalaries: number;
  keeperWorth: number;
  keeperSurplus: number;
  auctionMoney: number;
  auctionValue: number;
  multiplier: number;
  perTeam: TeamSurplus[];
  topDiscounts: DiscountLine[];
}

export function computeInflation(
  players: InflationPlayer[],
  capBudget: number = leagueRules.capBudget,
  numTeams?: number,
): InflationResult {
  const nTeams = numTeams ?? new Set(players.map((p) => p.teamId)).size;
  const capTotal = nTeams * capBudget;

  const totalWorth = players.reduce((s, p) => s + p.worth, 0);
  const f = totalWorth > 0 ? capTotal / totalWorth : 1;

  // Keep decisions and surplus use RAW worth (matches the keeper board), so normalization never
  // changes who's kept or the $ figures the user sees.
  const enriched = players.map((p) => ({ ...p, surplus: p.worth - p.salary }));
  const kept = enriched.filter((p) => p.surplus > 0);

  const keeperSalaries = kept.reduce((s, p) => s + p.salary, 0);
  const keeperWorth = kept.reduce((s, p) => s + p.worth, 0);
  const keeperSurplus = keeperWorth - keeperSalaries;
  const auctionMoney = capTotal - keeperSalaries;
  const auctionValue = Math.max(1, capTotal - keeperWorth);
  const multiplier = auctionMoney / auctionValue;

  const byTeam = new Map<number, TeamSurplus>();
  for (const p of kept) {
    const t =
      byTeam.get(p.teamId) ??
      { teamId: p.teamId, teamName: p.teamName, keptCount: 0, salaries: 0, worth: 0, surplus: 0 };
    t.keptCount++;
    t.salaries += p.salary;
    t.worth += p.worth;
    t.surplus += p.surplus;
    byTeam.set(p.teamId, t);
  }
  const perTeam = [...byTeam.values()]
    .map((t) => ({ ...t, salaries: Math.round(t.salaries), worth: Math.round(t.worth), surplus: Math.round(t.surplus) }))
    .sort((a, b) => b.surplus - a.surplus);

  const topDiscounts: DiscountLine[] = kept
    .map((p) => ({ name: p.name, position: p.position, teamId: p.teamId, teamName: p.teamName, worth: Math.round(p.worth), salary: Math.round(p.salary), surplus: Math.round(p.surplus) }))
    .sort((a, b) => b.surplus - a.surplus)
    .slice(0, 12);

  return {
    capTotal,
    numTeams: nTeams,
    calibration: Math.round(f * 100) / 100,
    keptCount: kept.length,
    releasedCount: players.length - kept.length,
    keeperSalaries: Math.round(keeperSalaries),
    keeperWorth: Math.round(keeperWorth),
    keeperSurplus: Math.round(keeperSurplus),
    auctionMoney: Math.round(auctionMoney),
    auctionValue: Math.round(auctionValue),
    multiplier: Math.round(multiplier * 100) / 100,
    perTeam,
    topDiscounts,
  };
}
