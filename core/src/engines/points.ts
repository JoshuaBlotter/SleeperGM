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
  return sumPoints(await fetchWeeks(leagueId, throughWeek, historical));
}

/** Per-player weekly game log (points for each week the player appears), in week order. Pure. */
export function weeklyPoints(weeks: RawMatchup[][]): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  for (const week of weeks) {
    const scored = new Map<string, number>(); // a player appears in at most one matchup per week
    for (const m of week) {
      if (!m.players_points) continue;
      for (const [pid, pts] of Object.entries(m.players_points)) scored.set(pid, pts ?? 0);
    }
    for (const [pid, pts] of scored) {
      if (!grid.has(pid)) grid.set(pid, []);
      grid.get(pid)!.push(Math.round(pts * 10) / 10);
    }
  }
  return grid;
}

/** Live: a season's per-player weekly game log. */
export async function seasonWeeklyPoints(leagueId: string, throughWeek = 17, historical = false): Promise<Map<string, number[]>> {
  return weeklyPoints(await fetchWeeks(leagueId, throughWeek, historical));
}

async function fetchWeeks(leagueId: string, throughWeek: number, historical: boolean): Promise<RawMatchup[][]> {
  const weeks: RawMatchup[][] = [];
  for (let w = 1; w <= throughWeek; w++) {
    const m = await sleeper.getMatchups(leagueId, w, historical);
    if (m && m.length) weeks.push(m);
  }
  return weeks;
}
