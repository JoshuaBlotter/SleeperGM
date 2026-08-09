import { expect, test } from "vitest";
import { computeScarcity, type ScarcityPlayer } from "../engines/scarcity";

const p = (id: string, position: string, value: number, kept: boolean): ScarcityPlayer => ({
  playerId: id, name: id, position, nflTeam: "SF", value, kept,
});

// RB tier mostly kept; WR tier mostly available.
const players: ScarcityPlayer[] = [
  p("rb1", "RB", 60, true), p("rb2", "RB", 50, true), p("rb3", "RB", 40, true), p("rb4", "RB", 10, false),
  p("wr1", "WR", 55, false), p("wr2", "WR", 45, true), p("wr3", "WR", 35, false), p("wr4", "WR", 25, false),
];

test("scarcity score = kept share of top-N value; RB scarcer than WR", () => {
  const [rb, wr] = computeScarcity(players, ["RB", "WR"], 4);
  // RB: kept 150 of 160 => 0.94
  expect(rb!.position).toBe("RB");
  expect(rb!.keptCount).toBe(3);
  expect(rb!.scarcityScore).toBeCloseTo(0.94, 2);
  // WR: kept 45 of 160 => 0.28
  expect(wr!.scarcityScore).toBeCloseTo(0.28, 2);
  expect(rb!.scarcityScore).toBeGreaterThan(wr!.scarcityScore);
});

test("bestAvailable = highest-value non-kept at the position (even outside top-N)", () => {
  const [rb, wr] = computeScarcity(players, ["RB", "WR"], 4);
  expect(rb!.bestAvailable?.playerId).toBe("rb4"); // only available RB
  expect(wr!.bestAvailable?.playerId).toBe("wr1"); // top available WR
});

test("empty position → zero score, null bestAvailable", () => {
  const [te] = computeScarcity(players, ["TE"], 4);
  expect(te!.scarcityScore).toBe(0);
  expect(te!.bestAvailable).toBeNull();
  expect(te!.players).toHaveLength(0);
});
