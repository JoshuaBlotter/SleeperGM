import { expect, test } from "vitest";
import { buildSeasonRecap, type RecapDraftPick, type RecapPlayerFacts } from "../engines/seasonRecap";
import type { SalarySeason } from "../engines/salaryHistory";

const yr = (season: string, salary: number, over: Partial<SalarySeason> = {}): SalarySeason => ({
  season, salary, event: "kept", increase: null, note: null, source: "computed", approximate: false, ...over,
});

const facts = new Map<string, RecapPlayerFacts>([
  // Bought at auction last year, still here.
  ["bought", {
    name: "Bought Guy", position: "WR", nflTeam: "SF", rostered: true, ownerTeam: "Team A", thisSalary: 42,
    salaryHistory: [yr("2025", 35, { event: "auction", source: "sleeper" }), yr("2026", 42, { increase: 7 })],
  }],
  // Rookie pick last year, still here.
  ["rook", {
    name: "Rookie Guy", position: "RB", nflTeam: "LV", rostered: true, ownerTeam: "Team B", thisSalary: 19,
    salaryHistory: [yr("2025", 12, { event: "rookie", note: "R1.01", source: "sleeper" }), yr("2026", 19, { increase: 7 })],
  }],
  // Kept through last year off the salary sheet — the years before it are a replay the sheet contradicts.
  ["kept", {
    name: "Kept Guy", position: "QB", nflTeam: "PHI", rostered: true, ownerTeam: "Team A", thisSalary: 29,
    salaryHistory: [yr("2024", 9, { approximate: true }), yr("2025", 22, { source: "sheet" }), yr("2026", 29, { source: "sheet", increase: 7 })],
  }],
  // Drafted last year and since dropped: no ladder left, but the pick still happened.
  ["dropped", { name: "Dropped Guy", position: "RB", nflTeam: "PIT", rostered: false, ownerTeam: null, thisSalary: null, salaryHistory: [] }],
]);

const auctionPicks: RecapDraftPick[] = [
  { playerId: "bought", kind: "auction", pickNo: 3, round: 1, slot: 3, salary: 35, byTeam: "Team A" },
];
const rookiePicks: RecapDraftPick[] = [
  { playerId: "rook", kind: "rookie", pickNo: 1, round: 1, slot: 1, salary: 12, byTeam: "Team B" },
  { playerId: "dropped", kind: "rookie", pickNo: 8, round: 1, slot: 8, salary: 2, byTeam: "Team C" },
];

const recap = buildSeasonRecap({ season: "2025", nextSeason: "2026", auctionPicks, rookiePicks, facts });

test("the auction recap prices each buy and shows what it became", () => {
  expect(recap.auction).toHaveLength(1);
  expect(recap.auction[0]).toMatchObject({ name: "Bought Guy", basis: "auction", lastSalary: 35, thisSalary: 42, delta: 7, byTeam: "Team A" });
});

test("the rookie recap runs in pick order and labels the slot", () => {
  expect(recap.rookie.map((r) => r.note)).toEqual(["R1.01", "R1.08"]);
  expect(recap.rookie[0]).toMatchObject({ lastSalary: 12, thisSalary: 19, delta: 7 });
});

test("a player drafted and since dropped keeps his draft salary and has no delta", () => {
  const gone = recap.rookie.find((r) => r.playerId === "dropped")!;
  expect(gone).toMatchObject({ lastSalary: 2, thisSalary: null, delta: null, rostered: false });
});

test("the ledger covers every rostered player, priciest first, with last season's basis", () => {
  expect(recap.ledger.map((r) => r.name)).toEqual(["Bought Guy", "Kept Guy", "Rookie Guy"]);
  expect(recap.ledger.find((r) => r.name === "Kept Guy")).toMatchObject({
    basis: "kept", lastSalary: 22, lastSource: "sheet", thisSalary: 29, delta: 7, approximate: false,
  });
});

test("totals add up to what the league is paying, and to the raise between seasons", () => {
  expect(recap.totals).toMatchObject({ auctionSpend: 35, auctionPicks: 1, rookiePicks: 2, ledgerLast: 69, ledgerThis: 90, ledgerDelta: 21 });
  expect(recap.totals.ledgerThis - recap.totals.ledgerLast).toBe(recap.totals.ledgerDelta);
});

test("a player with no row for last season shows how he arrived instead of a fabricated salary", () => {
  const newGuy = new Map<string, RecapPlayerFacts>([
    ["new", {
      name: "New Guy", position: "WR", nflTeam: "DAL", rostered: true, ownerTeam: "Team A", thisSalary: 15,
      salaryHistory: [yr("2026", 15, { event: "faab", source: "sleeper" })],
    }],
  ]);
  const r = buildSeasonRecap({ season: "2025", nextSeason: "2026", auctionPicks: [], rookiePicks: [], facts: newGuy });
  expect(r.ledger[0]).toMatchObject({ basis: "faab", lastSalary: null, delta: null, thisSalary: 15 });
});
