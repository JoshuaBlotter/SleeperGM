import type { FaabIndex, SeasonLink } from "../types";
import type { RawTransaction } from "../sleeper/client";
import { sleeper } from "../sleeper/client";

const REGULAR_SEASON_WEEKS = 18;

/** Reduce a season's transactions into player -> FAAB bid (latest add wins). Pure. */
export function indexTransactions(txns: RawTransaction[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) {
    if (t.status !== "complete") continue;
    if (t.type !== "waiver" && t.type !== "free_agent") continue;
    if (!t.adds) continue;
    const bid = t.type === "waiver" ? t.settings?.waiver_bid ?? 0 : 0;
    for (const playerId of Object.keys(t.adds)) {
      // Transactions arrive newest-first per week; keep the first (latest) seen.
      if (!m.has(playerId)) m.set(playerId, bid);
    }
  }
  return m;
}

export async function buildFaabIndex(chain: SeasonLink[]): Promise<FaabIndex> {
  const index: FaabIndex = new Map();
  for (const [i, link] of chain.entries()) {
    const historical = i > 0; // chain[0] is the current season; the rest are immutable
    const perPlayer = new Map<string, number>();
    for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
      const txns = (await sleeper.getTransactions(link.leagueId, week, historical)) ?? [];
      if (txns.length === 0) continue;
      const wk = indexTransactions(txns);
      for (const [pid, bid] of wk) if (!perPlayer.has(pid)) perPlayer.set(pid, bid);
    }
    index.set(link.season, perPlayer);
  }
  return index;
}
