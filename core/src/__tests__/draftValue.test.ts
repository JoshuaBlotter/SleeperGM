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
});
