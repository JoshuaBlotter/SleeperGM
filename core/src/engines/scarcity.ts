// Positional scarcity map (#3). PURE.
//
// When most of a position's top tier is kept, the auction pool for that position is gutted and prices
// spike (the classic RB run). League-wide inflation hides this; scarcity is per-position. "kept" here =
// currently rostered (a rational-keeper proxy) until managers lock their keepers — see the toolkit doc.

export interface ScarcityPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  value: number;
  kept: boolean; // rostered = off the auction board
}

export interface PositionScarcity {
  position: string;
  topN: number; // window size actually used (min of N and pool size)
  players: ScarcityPlayer[]; // the top-N by value, kept flag set
  keptCount: number;
  availableCount: number;
  keptValue: number;
  availableValue: number;
  scarcityScore: number; // 0..1 — share of top-N value that's off the board (higher = scarcer)
  bestAvailable: ScarcityPlayer | null; // best still-gettable player at the position (may be below top-N)
}

/**
 * Compute per-position scarcity over a value-ranked player pool.
 * @param players every fantasy-relevant player with a value + kept flag.
 * @param positions positions to report, in display order.
 * @param topN the tier window (e.g. 12 = one starter per team).
 */
export function computeScarcity(players: ScarcityPlayer[], positions: string[], topN: number): PositionScarcity[] {
  return positions.map((position) => {
    const pool = players.filter((p) => p.position === position).sort((a, b) => b.value - a.value);
    const top = pool.slice(0, topN);
    const keptValue = top.filter((p) => p.kept).reduce((s, p) => s + p.value, 0);
    const availableValue = top.filter((p) => !p.kept).reduce((s, p) => s + p.value, 0);
    const totalValue = keptValue + availableValue;
    return {
      position,
      topN: top.length,
      players: top,
      keptCount: top.filter((p) => p.kept).length,
      availableCount: top.filter((p) => !p.kept).length,
      keptValue,
      availableValue,
      scarcityScore: totalValue > 0 ? Math.round((keptValue / totalValue) * 100) / 100 : 0,
      bestAvailable: pool.find((p) => !p.kept) ?? null,
    };
  });
}
