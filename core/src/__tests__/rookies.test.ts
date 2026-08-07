import { expect, test } from "vitest";
import { computeRookieBoard, type StandingRow, type TradedPick } from "../engines/rookies";

// 4-team league. Reverse standings => worst record picks first.
const standings: StandingRow[] = [
  { rosterId: 1, teamName: "Alpha", wins: 10, losses: 3, ties: 0, pointsFor: 1500 }, // best
  { rosterId: 2, teamName: "Bravo", wins: 3, losses: 10, ties: 0, pointsFor: 1200 }, // worst
  { rosterId: 3, teamName: "Charlie", wins: 3, losses: 10, ties: 0, pointsFor: 1300 }, // worst-ish (tie on wins, more pts)
  { rosterId: 4, teamName: "Delta", wins: 6, losses: 7, ties: 0, pointsFor: 1400 },
];
const names: Record<number, string> = { 1: "Alpha", 2: "Bravo", 3: "Charlie", 4: "Delta" };
const nameOf = (id: number) => names[id] ?? `roster ${id}`;
const costFor = (slot: number, round: number): Record<string, number> => (round === 1 ? { RB: 13 - slot, WR: 10 - slot } : {});

function board(rounds = 1, snake = true, traded: TradedPick[] = []) {
  return computeRookieBoard({ season: "2026", standings, tradedPicks: traded, rounds, snake, orderBasis: "reverseRegularSeason", nameOf, costFor });
}

test("base order = reverse standings; wins asc then points asc breaks ties", () => {
  const b = board();
  // Bravo (3-10, 1200) < Charlie (3-10, 1300) < Delta (6-7) < Alpha (10-3)
  expect(b.baseOrder.map((s) => s.teamName)).toEqual(["Bravo", "Charlie", "Delta", "Alpha"]);
  expect(b.baseOrder[0]!.slot).toBe(1);
});

test("round 1 picks labeled and priced by slot", () => {
  const b = board();
  expect(b.picks).toHaveLength(4);
  const p1 = b.picks[0]!;
  expect(p1.label).toBe("1.01");
  expect(p1.ownerTeam).toBe("Bravo");
  expect(p1.traded).toBe(false);
  expect(p1.cost).toEqual({ RB: 12, WR: 9 }); // slot 1
});

test("traded pick shows new owner + via original team", () => {
  // Bravo's 1st-round pick (roster 2) dealt to Alpha (roster 1).
  const b = board(1, true, [{ round: 1, season: "2026", rosterId: 2, ownerId: 1, previousOwnerId: 2 }]);
  const p1 = b.picks[0]!;
  expect(p1.originalTeam).toBe("Bravo");
  expect(p1.ownerTeam).toBe("Alpha");
  expect(p1.traded).toBe(true);
  expect(p1.viaTeam).toBe("Bravo");
  // Draft capital: Alpha now holds 2 picks, Bravo 0.
  const alpha = b.byTeam.find((t) => t.teamName === "Alpha")!;
  const bravo = b.byTeam.find((t) => t.teamName === "Bravo")!;
  expect(alpha.picks).toHaveLength(2);
  expect(alpha.extra).toBe(1);
  expect(bravo.picks).toHaveLength(0);
  expect(bravo.extra).toBe(-1);
});

test("snake reverses even-round sequence; ownership stays per-team", () => {
  const b = board(2, true);
  const r2 = b.picks.filter((p) => p.round === 2);
  // Round 2 pick 1 (2.01) goes to the best team (last in round 1) = Alpha.
  expect(r2[0]!.label).toBe("2.01");
  expect(r2[0]!.ownerTeam).toBe("Alpha");
  // Non-round-1 cost unknown.
  expect(r2[0]!.cost).toEqual({});
  // Overall numbering continues across rounds.
  expect(r2[0]!.overall).toBe(5);
});
