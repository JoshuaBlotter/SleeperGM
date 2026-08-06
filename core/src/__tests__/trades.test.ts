import { expect, test } from "vitest";
import { computeTrades, type TradePlayer } from "../engines/trades";

const P = (name: string, teamId: number, worth: number, salary: number): TradePlayer => ({
  playerId: name, name, position: "RB", teamId, teamName: `T${teamId}`, worth, salary, surplus: worth - salary,
});

const all: TradePlayer[] = [
  P("MyStud", 1, 60, 20), // my chip (+40)
  P("MyBust", 1, 20, 35), // my dead weight (-15)
  P("TheirBargain", 2, 58, 8), // target (+50), comparable worth to MyStud
  P("TheirOverpay", 2, 22, 40), // their dead weight (-18), comparable worth to MyBust
];

test("splits my chips vs dead weight", () => {
  const r = computeTrades(all, 1);
  expect(r.myChips.map((p) => p.name)).toEqual(["MyStud"]);
  expect(r.myDeadWeight.map((p) => p.name)).toEqual(["MyBust"]);
});

test("targets = other teams' positive-surplus players, desc", () => {
  const r = computeTrades(all, 1);
  expect(r.targets[0]!.name).toBe("TheirBargain"); // +50
});

test("sharky swaps: talent-neutral, raise my surplus, with cap relief", () => {
  const r = computeTrades(all, 1);
  // Give MyStud (60, +40) for TheirBargain (58, +50): comparable worth, myGain +10.
  const top = r.swaps[0]!;
  expect(top.give.name).toBe("MyStud");
  expect(top.get.name).toBe("TheirBargain");
  expect(top.myGain).toBe(10); // 50 - 40
  expect(top.capRelief).toBe(12); // 20 - 8
});

test("partner filter restricts to one team", () => {
  const withThird = [...all, P("OtherTeamGuy", 3, 59, 5)];
  const r = computeTrades(withThird, 1, { partnerTeamId: 2 });
  expect(r.targets.every((p) => p.teamId === 2)).toBe(true);
});

test("positional need + mutual-fit fair swaps", () => {
  // Roster QB/RB/RB/WR/WR/TE/FLEX. Team1 deep at RB, thin at WR; Team2 the mirror.
  const roster = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"];
  const PP = (name: string, teamId: number, pos: string, worth: number, salary: number): TradePlayer => ({
    playerId: name, name, position: pos, teamId, teamName: `T${teamId}`, worth, salary, surplus: worth - salary,
  });
  const players = [
    // Team1: three startable RBs (depth), one startable WR (need another)
    PP("RB1a", 1, "RB", 40, 10), PP("RB1b", 1, "RB", 30, 10), PP("RB1c", 1, "RB", 25, 10),
    PP("WR1a", 1, "WR", 30, 10),
    // Team2: three startable WRs (depth), one startable RB (need another)
    PP("WR2a", 2, "WR", 38, 12), PP("WR2b", 2, "WR", 30, 12), PP("WR2c", 2, "WR", 26, 12),
    PP("RB2a", 2, "RB", 30, 12),
  ];
  const r = computeTrades(players, 1, { rosterPositions: roster, startable: 12 });

  // Team1 needs WR, has RB depth
  const wrNeed = r.myNeeds.find((n) => n.position === "WR")!.need;
  const rbNeed = r.myNeeds.find((n) => n.position === "RB")!.need;
  expect(wrNeed).toBeGreaterThan(0); // short a WR
  expect(rbNeed).toBeLessThan(0); // RB depth

  // A fair swap: give an RB (depth) to Team2 (who needs RB), get a WR (their depth) to fill my WR need
  expect(r.fairSwaps.length).toBeGreaterThan(0);
  const s = r.fairSwaps[0]!;
  expect(s.give.position).toBe("RB");
  expect(s.get.position).toBe("WR");
  expect(s.myFillsNeed && s.partnerFillsNeed).toBe(true);
});
