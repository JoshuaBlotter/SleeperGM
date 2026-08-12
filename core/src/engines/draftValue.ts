// Historical draft value (#2). PURE.
//
// Compares what last season's AUCTION buys actually cost against what we expect them to cost THIS
// season — so you can see whether the market has moved on a player. Carried keepers and rookie picks
// are excluded by the caller.
//
// The comparison is against INFLATED worth, not face worth (#12). Face worth is calibrated so the
// whole player pool sums to the auction budget; an actual auction price is what someone paid in a
// market where cheap keepers have already left the pool, which runs ~1.8x face in this league.
// Comparing the two directly made every player look 50-90% down — the mismatch was the units, not
// the market. Streamers (K/DEF) are not inflated, matching inflateBoard().

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
  marketWorth: number; // worth × inflation (what we expect it to COST this season) — the comparable number
  delta: number; // marketWorth - cost (positive = the market has moved up on them)
  deltaPct: number | null; // delta as % of cost (null when cost was 0)
  flagged: boolean; // a material buy whose price moved enough to be worth an override check
}

export interface DraftValueReport {
  auctionSeason: string; // e.g. "2025" — the season these players were bought at auction
  projectionSeason: string; // e.g. "2026" — the season we're projecting worth for
  multiplier: number; // the inflation applied to face worth to get marketWorth
  rows: DraftValueRow[];
  totalCost: number; // Σ last season's auction spend on these players
  totalWorth: number; // Σ this season's FACE worth for them
  totalMarketWorth: number; // Σ this season's inflated worth — the like-for-like total
}

const STREAMERS = new Set(["K", "DEF"]);
/** Below this the % swing is noise: a $1 flier going to $11 is +1000% and means nothing. */
export const FLAG_MIN_COST = 10;
/**
 * How far the price has to move before the value source is worth a second look. The real
 * distribution is bimodal — prices either barely move or collapse — so this threshold is not
 * sensitive: on the 2025 class, 40% flags 32 of 120 and 60% flags 29. 40 is chosen because it
 * catches the same-situation QB cases (Burrow at -48%) that prompted #12 while costing two rows.
 */
export const FLAG_PCT = 40;

/** Turn resolved auction buys into the report: inflate, add delta/%, flag outliers, total, sort. */
export function buildDraftValueReport(
  buys: AuctionBuy[],
  auctionSeason: string,
  projectionSeason: string,
  multiplier = 1,
): DraftValueReport {
  const rows: DraftValueRow[] = buys
    .map((b) => {
      const marketWorth = STREAMERS.has(b.position) ? b.worth : Math.round(b.worth * multiplier);
      const delta = marketWorth - b.cost;
      const deltaPct = b.cost > 0 ? Math.round((delta / b.cost) * 100) : null;
      return {
        ...b,
        marketWorth,
        delta,
        deltaPct,
        flagged: b.cost >= FLAG_MIN_COST && deltaPct !== null && Math.abs(deltaPct) >= FLAG_PCT,
      };
    })
    .sort((a, b) => b.cost - a.cost || b.marketWorth - a.marketWorth);

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalWorth = rows.reduce((s, r) => s + r.worth, 0);
  const totalMarketWorth = rows.reduce((s, r) => s + r.marketWorth, 0);
  return { auctionSeason, projectionSeason, multiplier, rows, totalCost, totalWorth, totalMarketWorth };
}
