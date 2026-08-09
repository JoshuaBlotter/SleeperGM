import { expect, test } from "vitest";
import { gradePlayer } from "../engines/playerDetail";
import type { WeekScore } from "../engines/points";

// Build a week-tagged log from a points array, starting at `start` week (contiguous).
const wk = (pts: number[], start = 1): WeekScore[] => pts.map((points, i) => ({ week: start + i, points }));

test("consistent producer → A / consistent (flat log, high median)", () => {
  const g = gradePlayer(wk([16, 15, 17, 14, 16, 15, 18, 15, 16, 14, 17, 15, 16, 15]), "WR");
  expect(g.games).toBe(14);
  expect(g.grade).toBe("A");
  expect(g.archetype).toBe("consistent");
  expect(g.cv).toBeLessThan(0.35);
});

test("elite + frequent booms → league-winner (the McCaffrey case, not 'steady')", () => {
  const g = gradePlayer(wk([28, 22, 19, 31, 24, 18, 26, 20, 15, 33, 21, 19, 27, 16, 22, 18, 25]), "RB");
  expect(g.grade).toBe("A");
  expect(g.boomCount).toBeGreaterThanOrEqual(Math.ceil(g.games * 0.4));
  expect(g.archetype).toBe("league-winner");
});

test("Kyle Pitts case → one-week-wonder, low grade despite a big week", () => {
  const g = gradePlayer(wk([40, 3, 2, 5, 4, 3, 2, 6, 3, 2, 1, 2, 3, 0]), "TE");
  expect(g.maxShare).toBeGreaterThanOrEqual(0.25); // 40/76 ≈ 0.53
  expect(g.archetype).toBe("one-week-wonder");
  expect(g.grade).toBe("C");
  expect(g.best).toBe(40);
});

test("boom-bust → high variance, not carried by a single week", () => {
  const g = gradePlayer(wk([22, 4, 25, 3, 20, 5, 21, 2, 24, 6, 19, 4, 23, 5]), "RB");
  expect(g.archetype).toBe("boom-bust");
  expect(g.cv).toBeGreaterThanOrEqual(0.6);
  expect(g.boomCount).toBeGreaterThan(1);
});

test("late first week + short log → late-riser, NOT injury-limited (the Michael Wilson case)", () => {
  // rostered from week 11 on, and productive — small sample but a breakout, not an injury
  const g = gradePlayer(wk([16, 14, 19, 12, 17, 15, 18], 11), "WR");
  expect(g.games).toBe(7);
  expect(g.firstWeek).toBe(11);
  expect(g.archetype).toBe("late-riser");
});

test("short log starting early → injury-limited (lost weeks)", () => {
  const g = gradePlayer(wk([18, 20, 15, 22]), "RB");
  expect(g.games).toBe(4);
  expect(g.firstWeek).toBe(1);
  expect(g.archetype).toBe("injury-limited");
});

test("grade uses median, so one 40-pt week doesn't lift a C to an A", () => {
  const g = gradePlayer(wk([40, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]), "WR");
  expect(g.median).toBe(8);
  expect(g.grade).toBe("C");
});
