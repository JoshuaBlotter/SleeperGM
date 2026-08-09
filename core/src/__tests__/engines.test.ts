import { expect, test } from "vitest";
import { accumulatedSalary, keeperCostNextYear } from "../engines/keepers";
import { summarizeCap } from "../engines/cap";
import { valuePlayers } from "../engines/valuation";
import { toSurplusLines } from "../engines/surplus";
import { leagueRules, outstandingRules, rookieBaseCost } from "../config/league-rules";
import type { KeeperLine, PlayerLite, Provenance } from "../types";

// --- salary replay / escalation (§6.1) ---
test("single-owner replay compounds: base + Σ(posBase + y)", () => {
  const wr: Provenance = {
    playerId: "x", acquiredVia: "auction", acquisitionCost: 1, acquisitionSeason: "2022", yearsKept: 4, costKnown: true,
  };
  // WR $1 drafted 2022, held to 2026: 1 + (6+1)+(6+2)+(6+3)+(6+4) = 35
  const { cost, isPlaceholder } = keeperCostNextYear(wr, "WR", { throughSeason: 2026 });
  expect(cost).toBe(35);
  expect(isPlaceholder).toBe(false);
});

test("accumulated salary carries through a trade; only the years term resets", () => {
  // origin 2022 $1 WR, traded to a new owner in 2023 (stint restarts) -> 2026
  const traded = accumulatedSalary({ originSeason: 2022, originCost: 1, position: "WR", stintStarts: [2022, 2023], throughSeason: 2026 });
  // 2023: +7 (owner1 y1)=8; 2024:+7 (owner2 y1)=15; 2025:+8=23; 2026:+9=32
  expect(traded).toBe(32);
  // vs never-traded (single stint) which would be higher because the years term keeps climbing
  const held = accumulatedSalary({ originSeason: 2022, originCost: 1, position: "WR", stintStarts: [2022], throughSeason: 2026 });
  expect(held).toBe(35);
});

test("QB escalation uses the $1 positional base", () => {
  const qb: Provenance = { playerId: "h", acquiredVia: "auction", acquisitionCost: 4, acquisitionSeason: "2022", yearsKept: 4, costKnown: true };
  // 4 + (1+1)+(1+2)+(1+3)+(1+4) = 18
  expect(keeperCostNextYear(qb, "QB", { throughSeason: 2026 }).cost).toBe(18);
});

test("K/DEF escalate flat +$1/yr", () => {
  const def: Provenance = { playerId: "d", acquiredVia: "faab", acquisitionCost: 2, acquisitionSeason: "2025", yearsKept: 1, costKnown: true };
  expect(keeperCostNextYear(def, "DEF", { throughSeason: 2026 }).cost).toBe(3); // 2 + 1
});

test("keeperCostNextYear respects floor", () => {
  const p: Provenance = { playerId: "y", acquiredVia: "free_agent", acquisitionCost: 0, acquisitionSeason: "2026", yearsKept: 0, costKnown: true };
  expect(keeperCostNextYear(p, "K", { throughSeason: 2026 }).cost).toBe(1); // floor
});

test("rookieBaseCost reads the (slot x position) table", () => {
  expect(rookieBaseCost(1, "RB")).toBe(12); // 1.01 RB
  expect(rookieBaseCost(1, "WR")).toBe(8);
  expect(rookieBaseCost(11, "WR")).toBe(1); // McConkey 1.11 WR
  expect(rookieBaseCost(12, "RB")).toBe(1); // Achane 1.12 RB
  expect(rookieBaseCost(3, "TE")).toBe(3);
});

test("keeperCostNextYear uses rookie table for base, then escalates by position", () => {
  const achane: Provenance = {
    playerId: "r", acquiredVia: "rookie", acquisitionCost: 0, acquisitionSeason: "2023",
    yearsKept: 3, costKnown: true, rookiePick: { round: 1, slot: 12 },
  };
  const { base, cost } = keeperCostNextYear(achane, "RB", { throughSeason: 2026 });
  expect(base).toBe(1); // 1.12 RB
  expect(cost).toBe(25); // 1 + (6+1)+(6+2)+(6+3)
});

// --- cap ---
test("summarizeCap totals against budget", () => {
  const cap = summarizeCap([40, 30, 10]);
  expect(cap).toMatchObject({ capBudget: 200, capUsed: 80, capAvailable: 120, count: 3 });
});

// --- valuation ---
test("valuePlayers ranks studs above replacement and floors at $1", () => {
  const meta = new Map<string, PlayerLite>([
    ["rb1", { id: "rb1", name: "RB1", position: "RB", team: null }],
    ["rb2", { id: "rb2", name: "RB2", position: "RB", team: null }],
    ["rb3", { id: "rb3", name: "RB3", position: "RB", team: null }],
    ["rb4", { id: "rb4", name: "RB4", position: "RB", team: null }],
  ]);
  const pointsByPlayer = new Map([
    ["rb1", 300], ["rb2", 200], ["rb3", 100], ["rb4", 100],
  ]);
  const values = valuePlayers({
    pointsByPlayer,
    meta,
    rosterPositions: ["RB", "RB", "BN"],
    numTeams: 2,
    budget: 200,
  });
  const v = (id: string) => values.get(id)!.value;
  expect(v("rb1")).toBeGreaterThan(v("rb2"));
  expect(v("rb2")).toBeGreaterThan(v("rb4"));
  expect(v("rb4")).toBe(1); // at/below replacement
  for (const line of values.values()) expect(line.value).toBeGreaterThanOrEqual(1);
});

test("K/DEF are streamers: flat ~$1 worth regardless of points, excluded from the pool", () => {
  const meta = new Map<string, PlayerLite>([
    ["rb1", { id: "rb1", name: "RB1", position: "RB", team: null }],
    ["rb2", { id: "rb2", name: "RB2", position: "RB", team: null }],
    ["k1", { id: "k1", name: "K1", position: "K", team: null }],
    ["def1", { id: "def1", name: "DEF1", position: "DEF", team: "SF" }],
  ]);
  const pointsByPlayer = new Map([
    ["rb1", 300], ["rb2", 100],
    ["k1", 200], ["def1", 190], // high points, but should NOT translate to worth
  ]);
  const values = valuePlayers({
    pointsByPlayer, meta, rosterPositions: ["RB", "RB", "K", "DEF", "BN"], numTeams: 2, budget: 200,
  });
  expect(values.get("k1")!.value).toBe(1); // kicker $1
  expect(values.get("def1")!.value).toBe(2); // defense $2
  expect(values.get("rb1")!.value).toBeGreaterThan(10); // studs still get real money
});

// --- surplus ---
test("toSurplusLines computes surplus, sorts desc, recommends", () => {
  const lines: KeeperLine[] = [
    kl("keepme", 30, 20), // worth-cost handled via values map below
    kl("cutme", 5, 50),
  ];
  const values = new Map([
    ["keepme", { playerId: "keepme", points: 0, par: 0, value: 40 }],
    ["cutme", { playerId: "cutme", points: 0, par: 0, value: 3 }],
  ]);
  const out = toSurplusLines(lines, values);
  expect(out[0]!.playerId).toBe("keepme");
  expect(out[0]!.surplus).toBe(20); // 40 - 20
  expect(out[0]!.recommendation).toBe("keep");
  expect(out[1]!.recommendation).toBe("cut");
});

function kl(id: string, acq: number, keep: number): KeeperLine {
  return {
    playerId: id, name: id, position: "RB", nflTeam: "SF", acquiredVia: "auction", acquisitionCost: acq,
    acquisitionSeason: "2025", yearsKept: 1, costKnown: true, baseCost: acq, keeperCostNextYear: keep,
    keeperCostIsPlaceholder: false, salarySource: "computed", approximate: false,
    lastSeasonPoints: null, yearsInLeague: null,
  };
}

// --- rules ---
test("league rules parse; no outstanding placeholders now that real rules are in", () => {
  expect(leagueRules.capBudget).toBe(200);
  expect(leagueRules.keeperEscalation.placeholder).toBe(false);
  expect(leagueRules.rookieCost.placeholder).toBe(false);
  expect(outstandingRules()).toHaveLength(0);
});
