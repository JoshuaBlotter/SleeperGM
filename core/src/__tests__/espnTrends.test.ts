import { expect, test } from "vitest";
import { parseEspnTrends } from "../values/espnTrends";
import { matchValues } from "../values/valueSheet";
import type { RawPlayer } from "../sleeper/client";

// A slice of the real paste, keeping every kind of noise: header lines above rank 1, a name repeated
// (concatenated + clean), an injury tag between name and team (Malik Nabers "Q"), a multi-slot
// position ("WR, CB"), ESPN's WSH spelling, a D/ST row, and a $0-salary player to drop.
const PASTE = `PLAYER INFO\tSNAKE DRAFT STATS\tSALARY CAP DRAFT STATS\t
Rank
Player
AVG PICK
7 DAY +/-
AVG SALARY
7 DAY +/-
%ROST
1
Jahmyr GibbsJahmyr Gibbs
Jahmyr Gibbs
DET
RB
1.6
0.0
64.4
+0.5
99.9
32
Malik NabersMalik Nabers
Malik Nabers
Q
NYG
WR
37.4
+0.2
22.4
+0.1
98.2
54
Terry McLaurinTerry McLaurin
Terry McLaurin
WSH
WR
61.8
+0.2
12.0
+0.1
94.1
74
Texans D/STTexans D/ST
Texans D/ST
HOU
D/ST
88.8
+0.8
3.5
+0.1
98.6
108
Travis HunterTravis Hunter
Travis Hunter
JAX
WR, CB
117.8
-0.4
1.7
-0.1
72.7
204
Odell Beckham Jr.Odell Beckham Jr.
Odell Beckham Jr.
NYG
WR
169.1
0.0
0.0
0.0
3.2`;

test("parses the noisy tail structurally: name, team, position, salary", () => {
  const rows = parseEspnTrends(PASTE);
  const byName = new Map(rows.map((r) => [r.name, r]));

  expect(byName.get("Jahmyr Gibbs")).toMatchObject({ position: "RB", team: "DET" });
  // injury tag ("Q") is skipped, not read as the name or the team
  expect(byName.get("Malik Nabers")).toMatchObject({ position: "WR", team: "NYG" });
  // WSH is respelled to Sleeper's WAS; "WR, CB" keeps the first slot
  expect(byName.get("Terry McLaurin")!.team).toBe("WAS");
  expect(byName.get("Travis Hunter")).toMatchObject({ position: "WR", team: "JAX" });
});

test("drops $0 (undrafted) players and skips the header block", () => {
  const rows = parseEspnTrends(PASTE);
  expect(rows.some((r) => r.name === "Odell Beckham Jr.")).toBe(false);
  expect(rows.some((r) => r.name === "Player" || r.name === "Rank")).toBe(false);
});

test("keeps the RAW salary (rounded to whole dollars, $1 floor) and sorts by it", () => {
  const rows = parseEspnTrends(PASTE);
  const byName = new Map(rows.map((r) => [r.name, r.value]));
  expect(byName.get("Jahmyr Gibbs")).toBe(64); // 64.4 -> 64, NOT rescaled up
  expect(byName.get("Malik Nabers")).toBe(22); // 22.4 -> 22
  expect(byName.get("Travis Hunter")).toBe(2); //  1.7 -> 2, sub-dollar rounds up, never below the $1 floor
  expect(rows[0]!.name).toBe("Jahmyr Gibbs"); // highest AVG SALARY sorts first
  expect(rows.every((r) => r.value >= 1)).toBe(true);
});

test("a D/ST becomes DEF + team code, which the matcher finds by team", () => {
  const rows = parseEspnTrends(PASTE);
  const def = rows.find((r) => r.position === "DEF")!;
  expect(def).toMatchObject({ name: "HOU Defense", team: "HOU" });
  const players: Record<string, RawPlayer> = { HOU: { position: "DEF", first_name: "Houston", last_name: "Texans" } };
  expect(matchValues(players, rows).byId.get("HOU")).toBe(def.value);
});
