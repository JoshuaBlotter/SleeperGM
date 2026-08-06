import { afterEach, expect, test } from "vitest";
import { __setSalarySheet, parseSalaryCsv, sheetSalary, sheetSupersededByReacquire } from "../config/salaries";

afterEach(() => __setSalarySheet(undefined));

test("sheetSalary looks up by playerId, then by case-insensitive name", () => {
  const sheet = {
    season: 2025,
    byPlayerId: { "5859": { salary: 36, yearsKept: 2 } },
    byName: { "a.j. brown": { salary: 36 } },
  };
  expect(sheetSalary(sheet, "5859", "whatever")).toEqual({ salary: 36, yearsKept: 2 });
  expect(sheetSalary(sheet, "nope", "A.J. Brown")).toEqual({ salary: 36 });
  expect(sheetSalary(sheet, "nope", "Nobody")).toBeUndefined();
});

test("no sheet -> undefined (falls back to computed salary)", () => {
  expect(sheetSalary(null, "5859", "A.J. Brown")).toBeUndefined();
});

test("sheet is superseded by an auction/FAAB re-acquire in its season or later (§6.3)", () => {
  // Javonte: sheet season 2025, re-auctioned 2025 -> sheet stale, use computed
  expect(sheetSupersededByReacquire(2025, "2025", "auction")).toBe(true);
  expect(sheetSupersededByReacquire(2025, "2026", "faab")).toBe(true);
  // Kept/traded before the sheet season -> sheet still authoritative
  expect(sheetSupersededByReacquire(2025, "2022", "auction")).toBe(false); // A.J. Brown (traded, basis 2022)
  expect(sheetSupersededByReacquire(2025, "2024", "rookie")).toBe(false); // McConkey
  expect(sheetSupersededByReacquire(2025, null, "unknown")).toBe(false);
});

test("parseSalaryCsv reads header, season, id/name, salary + yearsKept", () => {
  const csv = [
    "season,player_id,player_name,position,nfl_team,manager,status,old_salary,years_kept,salary_increase,new_salary",
    "2025,5859,A.J. Brown,WR,PHI,Josh Blotter,Keeper,28,2,8,36",
    '2025,7547,"Smith, Jr.",WR,MIA,Someone,Keeper,3,1,7,10',
  ].join("\n");
  const sheet = parseSalaryCsv(csv);
  expect(sheet.season).toBe(2025);
  expect(sheetSalary(sheet, "5859", "whatever")).toEqual({ salary: 36, yearsKept: 2 });
  expect(sheetSalary(sheet, "x", "a.j. brown")).toEqual({ salary: 36, yearsKept: 2 });
  // quoted field with an embedded comma parses correctly
  expect(sheetSalary(sheet, "7547", "x")).toEqual({ salary: 10, yearsKept: 1 });
});
