// Historical draft value (#2). PURE.
//
// Compares what last season's AUCTION buys actually cost against this season's projected worth — so you
// can see whether you're about to overpay again (e.g. did McCaffrey/Henry go big last year, and are we
// projecting them that high now?). Carried keepers and rookie picks are excluded by the caller.

export interface AuctionBuy {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  cost: number; // last season's auction price
  worth: number; // this season's projected worth (active value source)
  kept: boolean; // still rostered this season (a potential keeper, not back in the pool)
  ownerTeam: string | null; // current fantasy owner, if kept
  keeperCost: number | null; // this season's keeper cost, if kept
}

export interface DraftValueRow extends AuctionBuy {
  delta: number; // worth - cost (positive = projected higher than paid)
  deltaPct: number | null; // delta as % of cost (null when cost was 0)
}

export interface DraftValueReport {
  auctionSeason: string; // e.g. "2025" — the season these players were bought at auction
  projectionSeason: string; // e.g. "2026" — the season we're projecting worth for
  rows: DraftValueRow[];
  totalCost: number; // Σ last season's auction spend on these players
  totalWorth: number; // Σ this season's projected worth for them
}

/** Turn resolved auction buys into the report: add delta/%, totals, and sort by cost (priciest first). */
export function buildDraftValueReport(
  buys: AuctionBuy[],
  auctionSeason: string,
  projectionSeason: string,
): DraftValueReport {
  const rows: DraftValueRow[] = buys
    .map((b) => ({
      ...b,
      delta: b.worth - b.cost,
      deltaPct: b.cost > 0 ? Math.round(((b.worth - b.cost) / b.cost) * 100) : null,
    }))
    .sort((a, b) => b.cost - a.cost || b.worth - a.worth);

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalWorth = rows.reduce((s, r) => s + r.worth, 0);
  return { auctionSeason, projectionSeason, rows, totalCost, totalWorth };
}
