import { expect, test } from "vitest";
import { salaryLadder } from "../engines/salaryHistory";
import { accumulatedSalary } from "../engines/keepers";
import type { Provenance } from "../types";

const auction = (season: string, cost: number): Provenance => ({
  playerId: "p1", acquiredVia: "auction", acquisitionCost: cost, acquisitionSeason: season, yearsKept: 0, costKnown: true,
});
const rookie = (season: string, round: number, slot: number): Provenance => ({
  playerId: "p2", acquiredVia: "rookie", acquisitionCost: 0, acquisitionSeason: season, yearsKept: 0, costKnown: true,
  rookiePick: { round, slot },
});

test("one row per season, origin first, ending on the keeper cost the cap engine charges", () => {
  const rows = salaryLadder({ provenance: auction("2023", 20), position: "WR", stintStarts: [2023], throughSeason: 2026 });
  expect(rows.map((r) => r.season)).toEqual(["2023", "2024", "2025", "2026"]);
  expect(rows[0]).toMatchObject({ salary: 20, event: "auction", increase: null, source: "sleeper" });
  // WR base $6 + years kept in the stint: +7, +8, +9
  expect(rows.map((r) => r.salary)).toEqual([20, 27, 35, 44]);
  expect(rows.map((r) => r.increase)).toEqual([null, 7, 8, 9]);
  expect(rows[rows.length - 1]!.salary).toBe(
    accumulatedSalary({ originSeason: 2023, originCost: 20, position: "WR", stintStarts: [2023], throughSeason: 2026 }),
  );
});

test("a rookie pick is labelled with its slot and priced off the rookie table", () => {
  const rows = salaryLadder({ provenance: rookie("2025", 1, 4), position: "RB", stintStarts: [2025], throughSeason: 2026 });
  expect(rows[0]).toMatchObject({ event: "rookie", note: "R1.04", source: "sleeper" });
  expect(rows[0]!.salary).toBeGreaterThan(0);
  expect(rows[1]!.event).toBe("kept");
});

test("a trade shows up as its own season and resets the years-kept term", () => {
  const rows = salaryLadder({ provenance: auction("2023", 20), position: "WR", stintStarts: [2023, 2025], throughSeason: 2026 });
  expect(rows.map((r) => r.event)).toEqual(["auction", "kept", "traded", "kept"]);
  // The raise CARRIED INTO 2025 was earned under the old owner, so it still counts up (+8); the term
  // restarts the following offseason, which is the first one the new owner is responsible for (+7).
  expect(rows.map((r) => r.increase)).toEqual([null, 7, 8, 7]);
});

test("the salary sheet is authoritative from its season on, and flags the years it contradicts", () => {
  const opts = { provenance: auction("2023", 20), position: "WR" as const, stintStarts: [2023], throughSeason: 2026 };
  const rows = salaryLadder({ ...opts, anchor: { season: 2025, salary: 50, yearsKept: 2 } });

  expect(rows.find((r) => r.season === "2025")).toMatchObject({ salary: 50, source: "sheet", increase: null });
  expect(rows.find((r) => r.season === "2026")).toMatchObject({ salary: 59, source: "sheet", increase: 9 }); // yearsKept 3 → +6+3
  // The replay said $35 in 2025 and the sheet says $50, so the replayed years before it are suspect.
  expect(rows.filter((r) => r.approximate).map((r) => r.season)).toEqual(["2023", "2024"]);
});

test("a replay the sheet agrees with is not flagged", () => {
  const rows = salaryLadder({
    provenance: auction("2023", 20), position: "WR", stintStarts: [2023], throughSeason: 2026,
    anchor: { season: 2025, salary: 35, yearsKept: 2 },
  });
  expect(rows.some((r) => r.approximate)).toBe(false);
  expect(rows.map((r) => r.salary)).toEqual([20, 27, 35, 44]);
});

test("an anchor older than the acquisition is ignored — the player was re-acquired since", () => {
  const rows = salaryLadder({
    provenance: auction("2025", 30), position: "WR", stintStarts: [2025], throughSeason: 2026,
    anchor: { season: 2024, salary: 99, yearsKept: 3 },
  });
  expect(rows.map((r) => r.salary)).toEqual([30, 37]);
  expect(rows.every((r) => r.source !== "sheet")).toBe(true);
});

test("no acquisition season → no ladder rather than a fabricated one", () => {
  const unknown: Provenance = {
    playerId: "p3", acquiredVia: "unknown", acquisitionCost: 0, acquisitionSeason: null, yearsKept: 0, costKnown: false,
  };
  expect(salaryLadder({ provenance: unknown, position: "WR", stintStarts: [], throughSeason: 2026 })).toEqual([]);
});
