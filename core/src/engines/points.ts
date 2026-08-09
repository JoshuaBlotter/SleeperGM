import { sleeper } from "../sleeper/client";

/** One week's fantasy points for a player (the real NFL week number, so gaps/byes are visible). */
export interface WeekScore {
  week: number;
  points: number;
}

// Source of truth for scoring: Sleeper's per-week STATS endpoint, which covers EVERY player (not just
// those rostered in our league) and whose `pts_ppr` matches this league's scoring exactly (vanilla PPR,
// verified). A player-week is counted only when `gp >= 1` (actually played), so byes/DNPs are real gaps.

const REG_SEASON_WEEKS = 18;

/** A season's total fantasy points per player (PPR), from stats — all players, real games only. */
export async function seasonPoints(season: string, throughWeek = REG_SEASON_WEEKS): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  for (let w = 1; w <= throughWeek; w++) {
    const stats = await sleeper.getWeekStats(season, w);
    if (!stats) continue;
    for (const [id, st] of Object.entries(stats)) {
      if (!st || (st.gp ?? 0) < 1 || id.startsWith("TEAM_")) continue; // TEAM_* are team aggregates, not players
      totals.set(id, (totals.get(id) ?? 0) + (st.pts_ppr ?? 0));
    }
  }
  return totals;
}

/** A season's per-player weekly game log (PPR), week-tagged; only weeks the player actually played. */
export async function seasonWeeklyPoints(season: string, throughWeek = REG_SEASON_WEEKS): Promise<Map<string, WeekScore[]>> {
  const grid = new Map<string, WeekScore[]>();
  for (let w = 1; w <= throughWeek; w++) {
    const stats = await sleeper.getWeekStats(season, w);
    if (!stats) continue;
    for (const [id, st] of Object.entries(stats)) {
      if (!st || (st.gp ?? 0) < 1 || id.startsWith("TEAM_")) continue; // TEAM_* are team aggregates, not players
      if (!grid.has(id)) grid.set(id, []);
      grid.get(id)!.push({ week: w, points: Math.round((st.pts_ppr ?? 0) * 10) / 10 });
    }
  }
  return grid;
}
