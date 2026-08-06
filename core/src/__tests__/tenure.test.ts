import { expect, test } from "vitest";
import { ownerTenureStart, type AcquisitionIndex } from "../history/tenure";
import type { SeasonLink } from "../types";

const chain: SeasonLink[] = ["2026", "2025", "2024", "2023", "2022"].map((s) => ({
  season: s,
  leagueId: `L${s}`,
  draftId: `D${s}`,
}));

// A.J. Brown: drafted 2022 by owner X, traded to owner U in 2024.
function acqIndex(): AcquisitionIndex {
  return new Map([
    ["2026", new Map()],
    ["2025", new Map()],
    ["2024", new Map([["ajb", new Set(["U"])]])], // U acquires via trade in 2024
    ["2023", new Map()],
    ["2022", new Map([["ajb", new Set(["X"])]])], // X drafts in 2022
  ]);
}

test("tenure starts at the current owner's most-recent acquisition (trade resets it)", () => {
  expect(ownerTenureStart("ajb", "U", chain, acqIndex())).toBe("2024");
  // currentSeason 2026 - 2024 => yearsKept 2, NOT 4
});

test("original drafter's tenure reflects their own acquisition season", () => {
  expect(ownerTenureStart("ajb", "X", chain, acqIndex())).toBe("2022");
});

test("returns null when the owner never acquired the player", () => {
  expect(ownerTenureStart("ajb", "Z", chain, acqIndex())).toBeNull();
});

test("null owner yields null (caller falls back to cost-basis season)", () => {
  expect(ownerTenureStart("ajb", null, chain, acqIndex())).toBeNull();
});
