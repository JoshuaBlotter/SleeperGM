import type { SeasonLink } from "../types";
import { sleeper } from "../sleeper/client";

/**
 * Walk `previous_league_id` from the given league back to the first season.
 * Returns newest-first: [2026, 2025, ...]. Guards against cycles and long chains.
 */
export async function buildChain(leagueId: string, maxDepth = 25): Promise<SeasonLink[]> {
  const chain: SeasonLink[] = [];
  const seen = new Set<string>();
  let current: string | null = leagueId;

  for (let i = 0; i < maxDepth && current && !seen.has(current); i++) {
    seen.add(current);
    const league = await sleeper.getLeague(current);
    if (!league) break;
    chain.push({ season: league.season, leagueId: league.league_id, draftId: league.draft_id });
    current = league.previous_league_id;
  }
  return chain;
}
