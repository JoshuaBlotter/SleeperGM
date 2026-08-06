import { expect, test } from "vitest";
import { computeInflation, type InflationPlayer } from "../engines/inflation";

const P = (name: string, worth: number, salary: number, teamId: number, teamName: string): InflationPlayer => ({
  name, position: "RB", teamId, teamName, worth, salary,
});

test("keeps only positive-surplus players; sums surplus; computes the multiplier", () => {
  const players = [
    P("Stud A", 60, 20, 1, "T1"), // surplus +40 -> kept
    P("Bench B", 10, 15, 1, "T1"), // surplus -5 -> released
    P("Stud C", 50, 30, 2, "T2"), // surplus +20 -> kept
    P("Even D", 5, 5, 2, "T2"), // surplus 0 -> released (not > 0)
  ];
  const r = computeInflation(players, 100, 2); // capTotal = 200

  expect(r.keptCount).toBe(2);
  expect(r.releasedCount).toBe(2);
  expect(r.keeperSalaries).toBe(50); // 20 + 30
  expect(r.keeperWorth).toBe(110); // 60 + 50
  expect(r.keeperSurplus).toBe(60); // 110 - 50
  expect(r.auctionMoney).toBe(150); // 200 - 50
  expect(r.auctionValue).toBe(90); // 200 - 110
  expect(r.multiplier).toBeCloseTo(150 / 90, 2); // ~1.67
});

test("multiplier = 1 + keeperSurplus / auctionValue", () => {
  const players = [P("A", 60, 20, 1, "T1"), P("C", 50, 30, 2, "T2")];
  const r = computeInflation(players, 100, 2);
  expect(r.multiplier).toBeCloseTo(1 + r.keeperSurplus / r.auctionValue, 2);
});

test("ranks top discounts and per-team surplus by surplus desc", () => {
  const players = [P("Small", 30, 25, 1, "T1"), P("Big", 90, 10, 2, "T2")];
  const r = computeInflation(players, 100, 2);
  expect(r.topDiscounts[0]!.name).toBe("Big"); // +80 before +5
  expect(r.perTeam[0]!.teamName).toBe("T2");
});

test("no keepers -> no inflation (multiplier 1)", () => {
  const players = [P("Overpaid", 5, 40, 1, "T1")]; // negative surplus, released
  const r = computeInflation(players, 100, 2);
  expect(r.keptCount).toBe(0);
  expect(r.multiplier).toBe(1);
});
