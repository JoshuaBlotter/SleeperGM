import { expect, test } from "vitest";
import { matchValues, normalizeName, parseValueCsv } from "../values/valueSheet";
import { adpToAuctionValues, type AdpPlayer } from "../values/adp";
import type { RawPlayer } from "../sleeper/client";

const players: Record<string, RawPlayer> = {
  "4034": { player_id: "4034", full_name: "Christian McCaffrey", position: "RB", team: "SF" },
  "5849": { player_id: "5849", full_name: "A.J. Brown", position: "WR", team: "PHI" },
  "6790": { player_id: "6790", first_name: "Kenneth", last_name: "Walker", position: "RB", team: "SEA" },
  SF: { position: "DEF", first_name: "San Francisco", last_name: "49ers" },
};

test("normalizeName strips punctuation + suffixes", () => {
  expect(normalizeName("A.J. Brown")).toBe("aj brown");
  expect(normalizeName("Kenneth Walker III")).toBe("kenneth walker");
});

test("parseValueCsv reads flexible headers", () => {
  const rows = parseValueCsv("player,pos,team,$\nA.J. Brown,WR,PHI,45\nBad,,,notanumber");
  expect(rows).toEqual([{ name: "A.J. Brown", position: "WR", team: "PHI", value: 45 }]);
});

test("matchValues maps names (with suffix) and defenses to Sleeper ids", () => {
  const rows = parseValueCsv(
    ["name,position,team,value", "Christian McCaffrey,RB,SF,60", "Kenneth Walker III,RB,SEA,22", "San Francisco,DEF,SF,3", "Nobody Here,WR,DAL,10"].join("\n"),
  );
  const { byId, unmatched } = matchValues(players, rows);
  expect(byId.get("4034")).toBe(60);
  expect(byId.get("6790")).toBe(22); // matched despite the "III"
  expect(byId.get("SF")).toBe(3); // defense by team code
  expect(unmatched.map((r) => r.name)).toEqual(["Nobody Here"]);
});

test("adpToAuctionValues: fitted curve, floored at $1, sums near the pool", () => {
  const list: AdpPlayer[] = Array.from({ length: 200 }, (_, i) => ({
    name: `P${i}`,
    position: "RB",
    team: "SF",
    adp: i + 1,
  }));
  const vals = adpToAuctionValues(list, { numTeams: 12, budget: 200 });
  const v = (i: number) => vals.find((x) => x.name === `P${i}`)!.value;
  expect(v(0)).toBeGreaterThan(v(11)); // #1 worth more than #12
  expect(v(11)).toBeGreaterThan(v(100)); // convex decay
  expect(Math.min(...vals.map((x) => x.value))).toBe(1); // floor
  const total = vals.reduce((s, x) => s + x.value, 0);
  expect(total).toBeGreaterThan(2200); // ≈ 12 × $200 pool
  expect(total).toBeLessThan(2600);
});

// #18: the curve used to charge $100 for the #1 pick out of a $200 budget and flatten everything past
// about rank 130 to $1 — half the draftable board tied, so "top 12 at a position" was ordered by
// nothing. These are the two properties that broke, checked against ESPN's published auction values
// (its #1 is $57 in a 10-team/$200 league, ≈ $68 rescaled to ours; its rank-101 is $2).
test("adpToAuctionValues: priced like a real auction, and rank survives deep into the board", () => {
  const list: AdpPlayer[] = Array.from({ length: 256 }, (_, i) => ({ name: `P${i}`, position: "RB", team: "SF", adp: i + 1 }));
  const vals = adpToAuctionValues(list, { numTeams: 12, budget: 200 });
  const at = (rank: number) => vals[rank - 1]!.value;

  expect(at(1)).toBeGreaterThan(45); // a stud costs a quarter-to-a-third of a $200 budget...
  expect(at(1)).toBeLessThan(75); // ...not half of it
  expect(at(11)).toBeGreaterThan(at(1) * 0.7); // flat head: the top dozen cluster, as ESPN's do
  expect(at(101)).toBeGreaterThan(1); // rank still means something 100 picks in
  const draftable = vals.slice(0, 180);
  expect(draftable.filter((x) => x.value === 1).length).toBeLessThan(draftable.length / 3);
});
