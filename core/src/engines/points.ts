import type { RawMatchup } from "../sleeper/client";
import { sleeper } from "../sleeper/client";

/** Sum a season's per-player fantasy points from matchup payloads. Pure. */
export function sumPoints(weeks: RawMatchup[][]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const week of weeks) {
    for (const m of week) {
      if (!m.players_points) continue;
      for (const [pid, pts] of Object.entries(m.players_points)) {
        totals.set(pid, (totals.get(pid) ?? 0) + (pts ?? 0));
      }
    }
  }
  return totals;
}

/** Live: pull a season's regular-season matchups and total points per player. */
export async function seasonPoints(leagueId: string, throughWeek = 17, historical = false): Promise<Map<string, number>> {
  const weeks: RawMatchup[][] = [];
  for (let w = 1; w <= throughWeek; w++) {
    const m = await sleeper.getMatchups(leagueId, w, historical);
    if (m && m.length) weeks.push(m);
  }
  return sumPoints(weeks);
}
