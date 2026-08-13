import { expect, test } from "vitest";
import { espnToValueRows, type EspnPlayerNode } from "../values/espn";
import { matchValues } from "../values/valueSheet";
import type { RawPlayer } from "../sleeper/client";

const node = (fullName: string, defaultPositionId: number, proTeamId: number, auctionValue: number): EspnPlayerNode => ({
  player: { fullName, defaultPositionId, proTeamId, draftRanksByRankType: { PPR: { auctionValue, rank: 1 } } },
});

const payload: EspnPlayerNode[] = [
  node("Jahmyr Gibbs", 2, 8, 57),
  node("Ja'Marr Chase", 3, 4, 56),
  node("Trey McBride", 4, 22, 38),
  node("Josh Allen", 1, 2, 22),
  node("Cheap Guy", 3, 6, 1),
  node("Undrafted Guy", 3, 6, 0), // $0 = ESPN saying "not on the board"
  node("Some Linebacker", 48, 6, 9), // not a fantasy position here
];

test("espnToValueRows maps position/team ids and drops $0 players", () => {
  const rows = espnToValueRows(payload, { numTeams: 10, budget: 200 });
  expect(rows.map((r) => r.name)).toEqual(["Jahmyr Gibbs", "Ja'Marr Chase", "Trey McBride", "Josh Allen", "Cheap Guy"]);
  expect(rows[0]).toMatchObject({ position: "RB", team: "DET" });
  expect(rows[1]).toMatchObject({ position: "WR", team: "CIN" });
  expect(rows[2]).toMatchObject({ position: "TE", team: "ARI" });
  expect(rows[3]).toMatchObject({ position: "QB", team: "BUF" });
});

test("rescales ESPN's pool onto ours, with a $1 floor", () => {
  const raw = 57 + 56 + 38 + 22 + 1;
  const rows = espnToValueRows(payload, { numTeams: 12, budget: 200 });
  const total = rows.reduce((s, r) => s + r.value, 0);
  expect(total).toBeGreaterThan(2380); // ≈ 12 × $200, up to rounding
  expect(total).toBeLessThan(2420);
  expect(rows[0]!.value).toBe(Math.round((57 * 2400) / raw));

  // Scaling DOWN must not round a cheap player out of existence.
  const shrunk = espnToValueRows(payload, { numTeams: 1, budget: 100 });
  expect(shrunk[4]).toMatchObject({ name: "Cheap Guy", value: 1 });
});

test("defenses come out as DEF + team code, which is how the matcher finds them", () => {
  const rows = espnToValueRows([node("49ers D/ST", 16, 25, 5)], { numTeams: 12, budget: 200 });
  expect(rows[0]).toMatchObject({ name: "SF Defense", position: "DEF", team: "SF" });
  const players: Record<string, RawPlayer> = { SF: { position: "DEF", first_name: "San Francisco", last_name: "49ers" } };
  expect(matchValues(players, rows).byId.get("SF")).toBe(rows[0]!.value);
});
