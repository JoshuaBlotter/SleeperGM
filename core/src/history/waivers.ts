import type { FaabIndex, SeasonLink } from "../types";
import type { RawTransaction } from "../sleeper/client";
import { sleeper } from "../sleeper/client";

const REGULAR_SEASON_WEEKS = 18;

/** One completed add for a player: the FAAB bid it cost, and when it settled. */
export interface FaabAdd {
  bid: number;
  ts: number; // epoch ms — the ordering key that makes "latest add wins" (§6.3) robust
}

/**
 * Reduce a batch of transactions to player -> LATEST completed waiver/free-agent add. Pure.
 *
 * §6.3 (cut & re-acquire resets cost) means the MOST RECENT add sets a player's basis — so when a
 * player was dropped and re-added, the newest add wins. We order by `status_updated` (falling back to
 * `created`, then array order) so a later add always supersedes an earlier one, regardless of how the
 * upstream list happens to be sorted.
 */
export function indexAdds(txns: RawTransaction[]): Map<string, FaabAdd> {
  const m = new Map<string, FaabAdd>();
  for (const t of txns) {
    if (t.status !== "complete") continue;
    if (t.type !== "waiver" && t.type !== "free_agent") continue;
    if (!t.adds) continue;
    const bid = t.type === "waiver" ? t.settings?.waiver_bid ?? 0 : 0;
    const ts = t.status_updated ?? t.created ?? 0;
    for (const playerId of Object.keys(t.adds)) {
      const prev = m.get(playerId);
      // `>=` so that with equal/absent timestamps the later-listed add still wins.
      if (!prev || ts >= prev.ts) m.set(playerId, { bid, ts });
    }
  }
  return m;
}

/** Back-compat view: player -> latest FAAB bid for a single batch of transactions. Pure. */
export function indexTransactions(txns: RawTransaction[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const [pid, add] of indexAdds(txns)) m.set(pid, add.bid);
  return m;
}

/** Merge a week's adds into a season accumulator, keeping the latest add per player (§6.3). Pure. */
export function mergeSeasonAdds(into: Map<string, FaabAdd>, week: Map<string, FaabAdd>): void {
  for (const [pid, add] of week) {
    const prev = into.get(pid);
    if (!prev || add.ts >= prev.ts) into.set(pid, add);
  }
}

export async function buildFaabIndex(chain: SeasonLink[]): Promise<FaabIndex> {
  const index: FaabIndex = new Map();
  for (const [i, link] of chain.entries()) {
    const historical = i > 0; // chain[0] is the current season; the rest are immutable
    const perPlayer = new Map<string, FaabAdd>();
    for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
      const txns = (await sleeper.getTransactions(link.leagueId, week, historical)) ?? [];
      if (txns.length === 0) continue;
      mergeSeasonAdds(perPlayer, indexAdds(txns));
    }
    index.set(link.season, new Map([...perPlayer].map(([pid, add]) => [pid, add.bid])));
  }
  return index;
}
