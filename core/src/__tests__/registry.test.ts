import { expect, test } from "vitest";
import { buildRegistry, findTeam } from "../registry/teams";
import { rosters, users } from "./fixtures";

const registry = buildRegistry(rosters, users);

test("joins rosters + users, sorted by rosterId", () => {
  expect(registry.map((t) => t.rosterId)).toEqual([1, 2, 3]);
  expect(registry[0]!.teamName).toBe("EBITDAwgs");
  expect(registry[0]!.displayName).toBe("alice");
});

test("falls back to display name, then Team N, for missing team_name/owner", () => {
  expect(registry[2]!.teamName).toBe("Team 3"); // no owner
});

test("drops placeholder '0' starters", () => {
  expect(registry[0]!.starters).toEqual(["p_qb1", "p_rb1"]);
});

test("findTeam by rosterId", () => {
  expect(findTeam(registry, "2")!.teamName).toBe("Blotter trotters");
});

test("findTeam by fuzzy name (case-insensitive substring)", () => {
  expect(findTeam(registry, "ebitda")!.rosterId).toBe(1);
  expect(findTeam(registry, "trotter")!.rosterId).toBe(2);
});

test("findTeam returns undefined on no match", () => {
  expect(findTeam(registry, "zzz")).toBeUndefined();
});
