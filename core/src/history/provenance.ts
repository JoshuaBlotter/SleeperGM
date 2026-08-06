import type { DraftIndex, FaabIndex, Provenance, SeasonLink } from "../types";

/**
 * Determine how/when each player was most recently acquired, scanning seasons newest -> oldest.
 *
 * Rules baked in:
 *  - Within a season, an in-season FAAB add is more recent than that season's preseason draft,
 *    so FAAB is checked first (implements §6.3 reset-on-reacquire).
 *  - Trades are NOT priced events (they don't appear in draft/FAAB data), so a traded player's
 *    cost basis is naturally the original draft event that carries through the trade.
 *  - Rookie (linear) picks are recorded as via "rookie" with the pick slot; the dollar value is
 *    applied later by the keeper engine via the rookie schedule (§6.4).
 */
export function buildProvenance(
  playerIds: string[],
  chain: SeasonLink[],
  drafts: DraftIndex,
  faab: FaabIndex,
  currentSeason: string,
): Provenance[] {
  const currentYear = Number(currentSeason);
  return playerIds.map((playerId): Provenance => {
    for (const link of chain) {
      const bid = faab.get(link.season)?.get(playerId);
      if (bid !== undefined) {
        return dollarEvent(playerId, link.season, bid > 0 ? "faab" : "free_agent", bid, currentYear);
      }
      const ev = drafts.get(link.season)?.get(playerId);
      if (ev) {
        if (ev.source === "auction") {
          return dollarEvent(playerId, link.season, "auction", ev.amount, currentYear);
        }
        return {
          playerId,
          acquiredVia: "rookie",
          acquisitionCost: 0, // dollarized later via rookie schedule
          acquisitionSeason: link.season,
          yearsKept: yearsKept(link.season, currentYear),
          costKnown: true,
          rookiePick: { round: ev.round, slot: ev.slot },
        };
      }
    }
    return {
      playerId,
      acquiredVia: "unknown",
      acquisitionCost: 0,
      acquisitionSeason: null,
      yearsKept: 0,
      costKnown: false,
    };
  });
}

function dollarEvent(
  playerId: string,
  season: string,
  via: Provenance["acquiredVia"],
  cost: number,
  currentYear: number,
): Provenance {
  return {
    playerId,
    acquiredVia: via,
    acquisitionCost: Math.round(cost),
    acquisitionSeason: season,
    yearsKept: yearsKept(season, currentYear),
    costKnown: true,
  };
}

function yearsKept(season: string, currentYear: number): number {
  const acqYear = Number(season);
  return Number.isFinite(acqYear) ? Math.max(0, currentYear - acqYear) : 0;
}
