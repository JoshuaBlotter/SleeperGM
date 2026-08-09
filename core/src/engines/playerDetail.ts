// Player drilldown grading (#5). PURE.
//
// A season total hides *how* it was scored: Kyle Pitts was a TE1 by total on one record week but was
// otherwise unstartable. This grades a weekly game log for consistency and tags a draft archetype.
// Thresholds are estimates (per the user) — tune here; they're the only "opinion" in the module.

import type { WeekScore } from "./points";

export type Grade = "A" | "B" | "C";
export type Archetype = "league-winner" | "consistent" | "steady" | "boom-bust" | "one-week-wonder" | "bust" | "late-riser" | "injury-limited";

export interface PlayerGrade {
  games: number;
  total: number;
  ppg: number; // mean per game
  median: number; // per game (robust to one huge week)
  best: number;
  worst: number;
  stdev: number;
  cv: number; // coefficient of variation (stdev / mean) — 0 = flat, higher = swingy
  boomCount: number; // weeks at/above the position's boom line
  bustCount: number; // weeks at/below the position's bust line
  boomLine: number; // the position's boom threshold (so the UI colors bars by the SAME rule)
  bustLine: number; // the position's bust threshold
  maxShare: number; // biggest week as a share of the season total (0..1)
  firstWeek: number; // first league week with data (a late start ≈ waiver/breakout, not injury)
  lastWeek: number;
  grade: Grade;
  archetype: Archetype;
}

// Median weekly points → letter grade, by position. (User gave WR ~15/12/10; scaled for others.)
const GRADE_FLOOR: Record<string, { a: number; b: number }> = {
  QB: { a: 20, b: 16 },
  RB: { a: 14, b: 10 },
  WR: { a: 14, b: 11 },
  TE: { a: 11, b: 8 },
  K: { a: 9, b: 7 },
  DEF: { a: 9, b: 6 },
};
// Per-position boom (big week) / bust (dud) lines.
const BOOM_BUST: Record<string, { boom: number; bust: number }> = {
  QB: { boom: 25, bust: 14 },
  RB: { boom: 18, bust: 8 },
  WR: { boom: 18, bust: 8 },
  TE: { boom: 14, bust: 5 },
  K: { boom: 14, bust: 5 },
  DEF: { boom: 14, bust: 3 },
};
const FULL_SEASON_GAMES = 14; // fewer than this ≈ missed time

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** Grade a weekly game log for a position. `log` is the week-tagged game log (see weeklyPoints). */
export function gradePlayer(log: WeekScore[], position: string): PlayerGrade {
  const pos = position.toUpperCase();
  const weekly = log.map((w) => w.points);
  const games = weekly.length;
  const firstWeek = games ? Math.min(...log.map((w) => w.week)) : 0;
  const lastWeek = games ? Math.max(...log.map((w) => w.week)) : 0;
  const total = Math.round(weekly.reduce((s, x) => s + x, 0) * 10) / 10;
  const ppg = games ? total / games : 0;
  const med = median(weekly);
  const best = games ? Math.max(...weekly) : 0;
  const worst = games ? Math.min(...weekly) : 0;
  const variance = games ? weekly.reduce((s, x) => s + (x - ppg) ** 2, 0) / games : 0;
  const stdev = Math.sqrt(variance);
  const cv = ppg > 0 ? stdev / ppg : 0;
  const bb = BOOM_BUST[pos] ?? BOOM_BUST.WR!;
  const boomCount = weekly.filter((x) => x >= bb.boom).length;
  const bustCount = weekly.filter((x) => x <= bb.bust).length;
  const maxShare = total > 0 ? best / total : 0;

  const floor = GRADE_FLOOR[pos] ?? GRADE_FLOOR.WR!;
  const grade: Grade = med >= floor.a ? "A" : med >= floor.b ? "B" : "C";

  let archetype: Archetype;
  // Small sample: a late FIRST week means they weren't rostered until mid-season (a waiver/breakout add),
  // which is a "late riser", NOT an injury. A short log that starts early = actually lost weeks.
  if (games < 10) archetype = firstWeek >= 6 ? "late-riser" : "injury-limited";
  else if (grade === "A" && boomCount >= Math.ceil(games * 0.4)) archetype = "league-winner"; // elite floor + boomed ~half the weeks
  else if (boomCount === 0 && bustCount >= Math.ceil(games * 0.4)) archetype = "bust"; // never booms, mostly duds
  else if (maxShare >= 0.3 && boomCount <= 1) archetype = "one-week-wonder"; // one spike carried the total
  else if (cv >= 0.6 && boomCount >= 2) archetype = "boom-bust"; // real booms AND busts (must actually boom)
  else if (cv <= 0.35) archetype = "consistent";
  else archetype = "steady";

  return {
    games,
    total,
    ppg: Math.round(ppg * 10) / 10,
    median: Math.round(med * 10) / 10,
    best,
    worst,
    stdev: Math.round(stdev * 10) / 10,
    cv: Math.round(cv * 100) / 100,
    boomCount,
    bustCount,
    boomLine: bb.boom,
    bustLine: bb.bust,
    maxShare: Math.round(maxShare * 100) / 100,
    firstWeek,
    lastWeek,
    grade,
    archetype,
  };
}
