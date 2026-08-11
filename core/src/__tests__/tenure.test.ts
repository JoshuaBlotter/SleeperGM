import { expect, test } from "vitest";
import { ownerTenureStart, seasonsInLeague, type AcquisitionIndex, type PresenceIndex } from "../history/tenure";
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

// ---- yearsInLeague: a COUNT of seasons present, not the span since first appearance ----
// Issue #11: every player from the 2022 startup auction read the same "5y" regardless of
// whether they had actually been around, because the old math was currentYear - entry + 1.

/** `stay` is in the league every season; `gap` was drafted in 2022, left, and came back in 2025. */
function presenceIndex(): PresenceIndex {
  return new Map([
    ["2026", new Set(["stay", "gap"])],
    ["2025", new Set(["stay", "gap"])],
    ["2024", new Set(["stay"])],
    ["2023", new Set(["stay"])],
    ["2022", new Set(["stay", "gap"])],
  ]);
}

test("seasonsInLeague counts seasons present, so an unbroken tenure is the full chain", () => {
  expect(seasonsInLeague("stay", chain, presenceIndex())).toBe(5);
});

test("a player who left and returned counts only the seasons they were here", () => {
  // Present in 2022, 2025 and 2026 — three seasons. The span since 2022 would say five.
  expect(seasonsInLeague("gap", chain, presenceIndex())).toBe(3);
});

test("two players from the same startup draft can differ once one of them leaves", () => {
  const p = presenceIndex();
  expect(seasonsInLeague("stay", chain, p)).not.toBe(seasonsInLeague("gap", chain, p));
});

test("seasonsInLeague is null for a player who was never in the league", () => {
  expect(seasonsInLeague("ghost", chain, presenceIndex())).toBeNull();
});

test("a player present only in the current season counts one, not zero", () => {
  const p: PresenceIndex = new Map([["2026", new Set(["rookie"])]]);
  expect(seasonsInLeague("rookie", chain, p)).toBe(1);
});
