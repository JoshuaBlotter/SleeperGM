import { expect, test } from "vitest";
import { buildDraftValueReport, type AuctionBuy } from "../engines/draftValue";

const buys: AuctionBuy[] = [
  { playerId: "cmc", name: "Christian McCaffrey", position: "RB", nflTeam: "SF", cost: 60, worth: 45, kept: true, ownerTeam: "Comedor", keeperCost: 66 },
  { playerId: "henry", name: "Derrick Henry", position: "RB", nflTeam: "BAL", cost: 40, worth: 46, kept: false, ownerTeam: null, keeperCost: null },
  { playerId: "cheap", name: "Late Flier", position: "WR", nflTeam: "NYJ", cost: 0, worth: 8, kept: false, ownerTeam: null, keeperCost: null },
];

test("delta, deltaPct, totals computed; sorted by cost desc", () => {
  const r = buildDraftValueReport(buys, "2025", "2026");
  expect(r.auctionSeason).toBe("2025");
  expect(r.projectionSeason).toBe("2026");
  // sorted priciest-first
  expect(r.rows.map((x) => x.name)).toEqual(["Christian McCaffrey", "Derrick Henry", "Late Flier"]);
  const cmc = r.rows[0]!;
  expect(cmc.delta).toBe(-15); // 45 - 60 (projected lower than paid)
  expect(cmc.deltaPct).toBe(-25);
  expect(cmc.kept).toBe(true);
  const henry = r.rows[1]!;
  expect(henry.delta).toBe(6);
  expect(henry.deltaPct).toBe(15);
  // cost 0 -> null pct, not Infinity
  expect(r.rows[2]!.deltaPct).toBeNull();
  expect(r.totalCost).toBe(100);
  expect(r.totalWorth).toBe(99);
});

test("empty input yields zeroed totals", () => {
  const r = buildDraftValueReport([], "2025", "2026");
  expect(r.rows).toHaveLength(0);
  expect(r.totalCost).toBe(0);
  expect(r.totalWorth).toBe(0);
  expect(r.totalMarketWorth).toBe(0);
});

// #12: face worth is calibrated to the whole pool; an auction price is what someone paid in an
// inflated market. Comparing the two directly made every buy read 50-90% down.
test("delta compares COST against inflated worth, not face worth", () => {
  const r = buildDraftValueReport(buys, "2025", "2026", 2);
  const cmc = r.rows[0]!;
  expect(cmc.worth).toBe(45); // face worth is preserved
  expect(cmc.marketWorth).toBe(90); // 45 x 2
  expect(cmc.delta).toBe(30); // 90 - 60, not 45 - 60
  expect(cmc.deltaPct).toBe(50);
  expect(r.totalWorth).toBe(99);
  expect(r.totalMarketWorth).toBe(198);
  expect(r.multiplier).toBe(2);
});

test("streamers are not inflated, matching inflateBoard", () => {
  const k: AuctionBuy[] = [
    { playerId: "k1", name: "Kicker", position: "K", nflTeam: "DAL", cost: 1, worth: 5, kept: false, ownerTeam: null, keeperCost: null },
    { playerId: "d1", name: "Defense", position: "DEF", nflTeam: "SF", cost: 1, worth: 5, kept: false, ownerTeam: null, keeperCost: null },
  ];
  const r = buildDraftValueReport(k, "2025", "2026", 2);
  expect(r.rows.map((x) => x.marketWorth)).toEqual([5, 5]);
});

test("a multiplier of 1 leaves the old face-value comparison intact", () => {
  const r = buildDraftValueReport(buys, "2025", "2026", 1);
  expect(r.rows[0]!.delta).toBe(-15);
  expect(r.rows[0]!.marketWorth).toBe(45);
});

test("flags only material buys whose price moved far", () => {
  const rows: AuctionBuy[] = [
    // $27 buy now worth $8 face -> $8 market at x1: -70%, material and far => flagged
    { playerId: "burrow", name: "Joe Burrow", position: "QB", nflTeam: "CIN", cost: 27, worth: 8, kept: true, ownerTeam: "T", keeperCost: 30 },
    // $1 flier at +1000% is noise, not signal => not flagged
    { playerId: "maye", name: "Drake Maye", position: "QB", nflTeam: "NE", cost: 1, worth: 11, kept: true, ownerTeam: "T", keeperCost: 3 },
    // material but barely moved => not flagged
    { playerId: "flat", name: "Flat Guy", position: "WR", nflTeam: "NYJ", cost: 20, worth: 19, kept: false, ownerTeam: null, keeperCost: null },
  ];
  const r = buildDraftValueReport(rows, "2025", "2026", 1);
  const by = Object.fromEntries(r.rows.map((x) => [x.playerId, x.flagged]));
  expect(by.burrow).toBe(true);
  expect(by.maye).toBe(false);
  expect(by.flat).toBe(false);
});

test("flag boundaries are inclusive on cost and pct", () => {
  const at: AuctionBuy[] = [
    { playerId: "edge", name: "Edge", position: "WR", nflTeam: "NYJ", cost: 10, worth: 6, kept: false, ownerTeam: null, keeperCost: null },
    { playerId: "under", name: "Under", position: "WR", nflTeam: "NYJ", cost: 9, worth: 4, kept: false, ownerTeam: null, keeperCost: null },
    { playerId: "inside", name: "Inside", position: "WR", nflTeam: "NYJ", cost: 20, worth: 13, kept: false, ownerTeam: null, keeperCost: null },
  ];
  const r = buildDraftValueReport(at, "2025", "2026", 1);
  const by = Object.fromEntries(r.rows.map((x) => [x.playerId, { pct: x.deltaPct, flagged: x.flagged }]));
  expect(by.edge).toEqual({ pct: -40, flagged: true }); // cost == 10 and pct == -40: both edges included
  expect(by.under!.flagged).toBe(false); // cost 9 is below the floor even at -56%
  expect(by.inside).toEqual({ pct: -35, flagged: false }); // material but inside the band
});
