// ESPN auction values -> ValueRows (#21). PURE.
//
// ESPN publishes a per-player auction value on its public fantasy endpoint, calibrated to whatever
// league the request names. `leaguedefaults/3` is ESPN's stock PPR league — 10 teams x $200 — so the
// values sum to ITS pool ($2000), not ours. Everything here is the two conversions that need doing:
// ESPN's numeric position/team ids -> the codes Sleeper uses, and ESPN's pool -> our league's pool.
//
// The fetch lives in scripts/fetch-espn-values.ts; this file never touches the network.

import type { ValueRow } from "./valueSheet";

/** ESPN `defaultPositionId` -> position code. Anything else (IDP, etc.) is not fantasy-relevant here. */
export const ESPN_POSITIONS: Record<number, string> = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DEF" };

/** ESPN `proTeamId` -> NFL code, in Sleeper's spelling (WAS, not ESPN's WSH). 0 = free agent. */
export const ESPN_PRO_TEAMS: Record<number, string> = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET",
  9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN",
  17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC",
  25: "SF", 26: "SEA", 27: "TB", 28: "WAS", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU",
};

/** The shape of one entry in ESPN's `kona_player_info` response. Loosely typed — it's a raw payload. */
export interface EspnPlayerNode {
  player?: {
    fullName?: string;
    defaultPositionId?: number;
    proTeamId?: number;
    draftRanksByRankType?: Record<string, { auctionValue?: number; rank?: number } | undefined>;
  };
}

export interface EspnOptions {
  rankType?: string; // "PPR" (our league) / "STANDARD" / "SUPERFLEX"
  numTeams?: number; // OUR league, for rescaling
  budget?: number; // OUR per-team budget
}

/**
 * Convert an ESPN player payload into value rows, rescaled from ESPN's pool to ours.
 *
 * Only players ESPN prices above $0 are kept: a $0 is ESPN saying "not on the draft board", which is
 * signal to LEAVE OUT, not a $0 row to rank. The floor is $1 so a rescaled cheap player never
 * disappears, and defenses are emitted as `DEF` + team code because that's how the matcher finds them.
 */
export function espnToValueRows(nodes: EspnPlayerNode[], opts: EspnOptions = {}): ValueRow[] {
  const rankType = opts.rankType ?? "PPR";
  const targetPool = (opts.numTeams ?? 12) * (opts.budget ?? 200);

  const priced: { name: string; position: string; team: string | undefined; raw: number }[] = [];
  for (const node of nodes) {
    const p = node.player;
    if (!p?.fullName) continue;
    const position = ESPN_POSITIONS[p.defaultPositionId ?? -1];
    if (!position) continue;
    const raw = p.draftRanksByRankType?.[rankType]?.auctionValue ?? 0;
    if (!(raw > 0)) continue;
    priced.push({ name: p.fullName, position, team: ESPN_PRO_TEAMS[p.proTeamId ?? -1], raw });
  }

  const sourcePool = priced.reduce((s, x) => s + x.raw, 0);
  const scale = sourcePool > 0 ? targetPool / sourcePool : 1;

  return priced
    .sort((a, b) => b.raw - a.raw || a.name.localeCompare(b.name))
    .map((x) => ({
      // "49ers D/ST" is not a name the matcher can use; the team code is, and it's what it looks at.
      name: x.position === "DEF" ? `${x.team ?? x.name} Defense` : x.name,
      position: x.position,
      team: x.team,
      value: Math.max(1, Math.round(x.raw * scale)),
    }));
}
