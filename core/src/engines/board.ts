// The one ordering every value board uses (tiers, scarcity). PURE.
//
// Dollars are the ranking, but a value source produces a LOT of ties — ESPN prices 39 of its 160
// players at $1, and eight tight ends at $2 — and JS sort is stable, so a plain `b.value - a.value`
// leaves ties in whatever order the value map was built in (Sleeper's player-id order). That is how a
// "top 12 at the position" window ends up holding a blocking tight end instead of George Kittle (#18):
// they cost the same and the older Sleeper id sorted first.
//
// So ties break on last season's points — the only other fact the board actually has — and then on
// name, so the order is total and reproducible instead of an artifact of iteration order.

export interface BoardPlayer {
  name: string;
  value: number;
  points?: number; // last completed season's fantasy points; absent = didn't score
}

/** Sort comparator: dollars desc, then last season's points desc, then name. */
export function compareBoard(a: BoardPlayer, b: BoardPlayer): number {
  return b.value - a.value || (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name);
}
