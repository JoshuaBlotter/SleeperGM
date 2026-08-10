import { expect, test } from "vitest";
import { computeLeagueBrain, type TeamBrainInput } from "../engines/leagueBrain";

/** A team input with sensible defaults; override what a test cares about. */
function team(over: Partial<TeamBrainInput> & { rosterId: number }): TeamBrainInput {
  return {
    teamName: `Team ${over.rosterId}`,
    manager: `Mgr ${over.rosterId}`,
    lastSeasonWins: 7,
    rosterValue: 200,
    keeperSurplus: 50,
    posCounts: { QB: 2, RB: 4, WR: 5, TE: 2 },
    spendByPos: { QB: 30, RB: 80, WR: 70, TE: 20 },
    tradeCount: 1,
    rookiePicks: 1,
    avgYearsExp: 4,
    volatility: 0.25,
    agingRbCount: 0,
    regret: 0,
    biggestBust: null,
    ...over,
  };
}

test("contenderIndex ranks a rich/cheap/winning team above a poor/expensive/losing one", () => {
  const strong = team({ rosterId: 1, rosterValue: 400, keeperSurplus: 200, lastSeasonWins: 12 });
  const weak = team({ rosterId: 2, rosterValue: 80, keeperSurplus: -20, lastSeasonWins: 2 });
  const { profiles } = computeLeagueBrain([strong, weak], { spendSeasons: 3 });
  expect(profiles[0]!.rosterId).toBe(1); // sorted by index desc
  const s = profiles.find((p) => p.rosterId === 1)!;
  const w = profiles.find((p) => p.rosterId === 2)!;
  expect(s.contenderIndex).toBeGreaterThan(w.contenderIndex);
});

test("archetype: young + stocked + low index → rebuilding; old + high index → win-now", () => {
  const teams = [
    team({ rosterId: 1, rosterValue: 400, keeperSurplus: 200, lastSeasonWins: 12, avgYearsExp: 8, rookiePicks: 0 }),
    team({ rosterId: 2, rosterValue: 250, keeperSurplus: 60, lastSeasonWins: 7 }),
    team({ rosterId: 3, rosterValue: 60, keeperSurplus: -40, lastSeasonWins: 1, avgYearsExp: 1, rookiePicks: 4 }),
  ];
  const { profiles } = computeLeagueBrain(teams, { spendSeasons: 3 });
  expect(profiles.find((p) => p.rosterId === 1)!.archetype).toBe("win-now"); // old + top third
  expect(profiles.find((p) => p.rosterId === 3)!.archetype).toBe("rebuilding"); // young + stocked + bottom third
});

test("tags: RB-heavy roster is an RB hoarder; QB-spend max pays up at QB; min-TE-spend waits on TE", () => {
  const teams = [
    team({ rosterId: 1, posCounts: { QB: 2, RB: 8, WR: 4, TE: 2 }, spendByPos: { QB: 90, RB: 60, WR: 40, TE: 10 } }),
    team({ rosterId: 2, posCounts: { QB: 2, RB: 3, WR: 6, TE: 2 }, spendByPos: { QB: 10, RB: 90, WR: 90, TE: 60 } }),
    team({ rosterId: 3, posCounts: { QB: 2, RB: 3, WR: 5, TE: 3 }, spendByPos: { QB: 20, RB: 80, WR: 80, TE: 40 } }),
  ];
  const { profiles } = computeLeagueBrain(teams, { spendSeasons: 3 });
  const t1 = profiles.find((p) => p.rosterId === 1)!;
  expect(t1.tags).toContain("RB hoarder"); // 8 RBs, well above mean
  expect(t1.tags).toContain("pays up at QB"); // highest QB spend share
  expect(t1.tags).toContain("waits on TE"); // lowest TE spend share
});

test("spendShare is blank when a team has no observed auction spend (no fabricated tendency)", () => {
  const teams = [
    team({ rosterId: 1, spendByPos: {} }),
    team({ rosterId: 2 }),
  ];
  const { profiles } = computeLeagueBrain(teams, { spendSeasons: 0 });
  expect(Object.keys(profiles.find((p) => p.rosterId === 1)!.spendShare)).toHaveLength(0);
});

test("superlatives: arg-max team wins each award; the scouting line references the driving number", () => {
  const teams = [
    team({ rosterId: 1, posCounts: { QB: 2, RB: 9, WR: 3, TE: 1 }, tradeCount: 5, rookiePicks: 4, keeperSurplus: 300, rosterValue: 500 }),
    team({ rosterId: 2, posCounts: { QB: 2, RB: 3, WR: 6, TE: 2 }, tradeCount: 0, rookiePicks: 0, keeperSurplus: 10 }),
  ];
  const { profiles, superlatives } = computeLeagueBrain(teams, { spendSeasons: 2 });
  const rb = superlatives.find((s) => s.id === "rb-hoarder")!;
  expect(rb.rosterId).toBe(1);
  expect(rb.stat).toContain("9");

  expect(superlatives.find((s) => s.id === "wheeler-dealer")!.rosterId).toBe(1);
  expect(superlatives.find((s) => s.id === "best-keepers")!.rosterId).toBe(1);
  expect(superlatives.find((s) => s.id === "capital-baron")!.rosterId).toBe(1);

  // Team 1 hoards RBs → its scouting line calls out the 9 running backs.
  expect(profiles.find((p) => p.rosterId === 1)!.scouting).toContain("9");
});

test("v3.1 signals: volatility/aging/regret drive tags and awards", () => {
  const teams = [
    team({
      rosterId: 1,
      volatility: 0.6,
      agingRbCount: 3,
      regret: 40,
      biggestBust: { name: "Bustman", paid: 45, worth: 8 },
    }),
    team({ rosterId: 2, volatility: 0.1, agingRbCount: 0, regret: 0 }),
    team({ rosterId: 3, volatility: 0.3, agingRbCount: 1, regret: 5 }),
  ];
  const { profiles, superlatives } = computeLeagueBrain(teams, { spendSeasons: 2 });
  const t1 = profiles.find((p) => p.rosterId === 1)!;
  expect(t1.tags).toContain("boom-or-bust roster");
  expect(t1.tags).toContain("aging RB corps");
  expect(t1.tags).toContain("last year's overpayer");
  expect(profiles.find((p) => p.rosterId === 2)!.tags).toContain("steady floor");

  expect(superlatives.find((s) => s.id === "boom-bust")!.rosterId).toBe(1);
  expect(superlatives.find((s) => s.id === "aging-rbs")!.rosterId).toBe(1);
  const remorse = superlatives.find((s) => s.id === "buyers-remorse")!;
  expect(remorse.rosterId).toBe(1);
  expect(remorse.stat).toContain("Bustman");
});

test("v3.1 awards are omitted when no team clears the data threshold", () => {
  const teams = [
    team({ rosterId: 1, volatility: null, agingRbCount: 0, regret: 0 }),
    team({ rosterId: 2, volatility: null, agingRbCount: 1, regret: 5 }),
  ];
  const { superlatives } = computeLeagueBrain(teams, { spendSeasons: 1 });
  expect(superlatives.find((s) => s.id === "boom-bust")).toBeUndefined(); // no graded volatility
  expect(superlatives.find((s) => s.id === "aging-rbs")).toBeUndefined(); // nobody at 2+ vets
  expect(superlatives.find((s) => s.id === "buyers-remorse")).toBeUndefined(); // regret below $15
});

test("degenerate all-equal league → everyone near 50, no crash", () => {
  const teams = [team({ rosterId: 1 }), team({ rosterId: 2 }), team({ rosterId: 3 })];
  const { profiles } = computeLeagueBrain(teams, { spendSeasons: 1 });
  for (const p of profiles) expect(p.contenderIndex).toBe(50);
});
