import { expect, test } from "vitest";
import { bandize, tierize, type TierPlayer } from "../engines/tiers";

const mk = (value: number): TierPlayer => ({ playerId: `p${value}`, name: `p${value}`, position: "RB", nflTeam: "SF", value });

test("gap-clusters by value; big drops start new tiers", () => {
  // 60,58 | 46 | 30,29,28 | 10,9  (drops of 12/16/18 break tiers; 1-2 gaps don't)
  const tiers = tierize([60, 58, 46, 30, 29, 28, 10, 9].map(mk), { gapPct: 0.2, minGap: 2 });
  expect(tiers.map((t) => t.players.map((p) => p.value))).toEqual([[60, 58], [46], [30, 29, 28], [10, 9]]);
  expect(tiers[0]!.label).toBe("Elite");
  expect(tiers[1]!.label).toBe("Tier 2");
  expect(tiers[0]!.maxValue).toBe(60);
  expect(tiers[0]!.minValue).toBe(58);
});

test("Josh Allen sits alone above the QB pack", () => {
  const qbs = [{ n: "Allen", v: 32 }, { n: "Daniels", v: 15 }, { n: "Hurts", v: 13 }, { n: "Goff", v: 6 }, { n: "Prescott", v: 6 }];
  const tiers = tierize(qbs.map((q) => ({ playerId: q.n, name: q.n, position: "QB", nflTeam: null, value: q.v })), { gapPct: 0.2, minGap: 2 });
  expect(tiers[0]!.players.map((p) => p.name)).toEqual(["Allen"]);
  expect(tiers.length).toBeGreaterThan(1);
});

test("limit caps how many players get tiered", () => {
  const tiers = tierize([50, 40, 30, 20, 10].map(mk), { limit: 3 });
  expect(tiers.flatMap((t) => t.players).length).toBe(3);
});

test("bandize buckets by fixed $ range (cross-position), drops below lowest edge", () => {
  const p = (name: string, position: string, value: number): TierPlayer => ({ playerId: name, name, position, nflTeam: null, value });
  const bands = bandize([
    p("Chase", "WR", 87),
    p("Brown", "WR", 20),
    p("McBride", "TE", 20), // TE lands beside the $14–21 WRs
    p("Deep", "RB", 3), // below lowest edge (8) → dropped
  ]);
  const top = bands[0]!;
  expect(top.label).toBe("$60+");
  expect(top.players.map((x) => x.name)).toEqual(["Chase"]);
  const band2021 = bands.find((b) => b.label === "$14–21")!;
  expect(band2021.players.map((x) => x.name).sort()).toEqual(["Brown", "McBride"]);
  expect(bands.flatMap((b) => b.players).some((x) => x.name === "Deep")).toBe(false);
});
