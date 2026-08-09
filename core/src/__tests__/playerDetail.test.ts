import { expect, test } from "vitest";
import { gradePlayer } from "../engines/playerDetail";

test("consistent producer → A / consistent (flat log, high median)", () => {
  const g = gradePlayer([16, 15, 17, 14, 16, 15, 18, 15, 16, 14, 17, 15, 16, 15], "WR");
  expect(g.games).toBe(14);
  expect(g.grade).toBe("A");
  expect(g.archetype).toBe("consistent");
  expect(g.cv).toBeLessThan(0.35);
});

test("elite + frequent booms → league-winner (the McCaffrey case, not 'steady')", () => {
  // 17 games, high floor, boom (RB ≥18) most weeks
  const weekly = [28, 22, 19, 31, 24, 18, 26, 20, 15, 33, 21, 19, 27, 16, 22, 18, 25];
  const g = gradePlayer(weekly, "RB");
  expect(g.grade).toBe("A");
  expect(g.boomCount).toBeGreaterThanOrEqual(Math.ceil(g.games * 0.4));
  expect(g.archetype).toBe("league-winner");
});

test("Kyle Pitts case → one-week-wonder, low grade despite a big week", () => {
  // one 40-burger, otherwise duds; total 76 over 14 games (~5.4 ppg, median low)
  const weekly = [40, 3, 2, 5, 4, 3, 2, 6, 3, 2, 1, 2, 3, 0];
  const g = gradePlayer(weekly, "TE");
  expect(g.maxShare).toBeGreaterThanOrEqual(0.25); // 40/76 ≈ 0.53
  expect(g.archetype).toBe("one-week-wonder");
  expect(g.grade).toBe("C"); // median ~3, well below TE floor
  expect(g.best).toBe(40);
});

test("boom-bust → high variance, not carried by a single week", () => {
  const g = gradePlayer([22, 4, 25, 3, 20, 5, 21, 2, 24, 6, 19, 4, 23, 5], "RB");
  expect(g.archetype).toBe("boom-bust");
  expect(g.cv).toBeGreaterThanOrEqual(0.6);
  expect(g.boomCount).toBeGreaterThan(1);
});

test("injury-limited when fewer than 10 games", () => {
  const g = gradePlayer([18, 20, 15, 22], "RB");
  expect(g.games).toBe(4);
  expect(g.archetype).toBe("injury-limited");
});

test("grade uses median, so one 40-pt week doesn't lift a C to an A", () => {
  const g = gradePlayer([40, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8], "WR");
  expect(g.median).toBe(8);
  expect(g.grade).toBe("C");
});
