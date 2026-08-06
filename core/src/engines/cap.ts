import type { LeagueRules } from "../config/league-rules";
import { leagueRules } from "../config/league-rules";

export interface CapSummary {
  capBudget: number;
  capUsed: number;
  capAvailable: number;
  count: number;
}

/** Sum keeper costs into a cap summary. Taxi/IR are already priced normally upstream (§6.5). */
export function summarizeCap(keeperCosts: number[], rules: LeagueRules = leagueRules): CapSummary {
  const capUsed = keeperCosts.reduce((a, b) => a + b, 0);
  return {
    capBudget: rules.capBudget,
    capUsed,
    capAvailable: rules.capBudget - capUsed,
    count: keeperCosts.length,
  };
}
