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

test("adpToAuctionValues: convex, floored at $1, sums near the pool", () => {
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
