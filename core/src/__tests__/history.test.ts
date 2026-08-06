import { expect, test } from "vitest";
import { indexPicks } from "../history/prices";
import { indexTransactions } from "../history/waivers";
import { buildProvenance } from "../history/provenance";
import type { AcqEvent, DraftIndex, FaabIndex } from "../types";
import { chain, picks2024, picks2025, rookiePicks2024, txns2025 } from "./fixtures";

test("indexPicks classifies auction ($) vs rookie (round/slot) picks", () => {
  const auction = indexPicks(picks2025);
  expect(auction.get("p_qb1")).toEqual({ source: "auction", amount: 45, isKeeper: false });

  const rookie = indexPicks(rookiePicks2024);
  expect(rookie.get("p_rook1")).toEqual({ source: "rookie", round: 1, slot: 11 });
  expect(rookie.get("p_rook2")).toEqual({ source: "rookie", round: 2, slot: 1 });
});

test("indexTransactions keeps completed waiver/free-agent adds with FAAB", () => {
  const idx = indexTransactions(txns2025);
  expect(idx.get("p_wr1")).toBe(17); // waiver bid
  expect(idx.get("p_fa1")).toBe(0); // free agent
  expect(idx.has("p_ignored")).toBe(false); // failed
  expect(idx.has("p_traded")).toBe(false); // trade, not an add-for-cost
});

// Build indexes the way buildDraftIndex would (auctions + rookie draft merged per season).
function draftIndex(): DraftIndex {
  const s2025 = indexPicks(picks2025);
  const s2024 = new Map<string, AcqEvent>([...indexPicks(picks2024), ...indexPicks(rookiePicks2024)]);
  return new Map([
    ["2025", s2025],
    ["2024", s2024],
  ]);
}
function faabIndex(): FaabIndex {
  return new Map([["2025", indexTransactions(txns2025)]]);
}

test("re-acquisition resets to most-recent auction (§6.3)", () => {
  const [rb1] = buildProvenance(["p_rb1"], chain, draftIndex(), faabIndex(), "2026");
  expect(rb1).toMatchObject({ acquiredVia: "auction", acquisitionCost: 30, acquisitionSeason: "2025", yearsKept: 1 });
});

test("traded player keeps original draft basis (carries through the trade)", () => {
  const [t] = buildProvenance(["p_trade1"], chain, draftIndex(), faabIndex(), "2026");
  // auctioned $8 in 2024, traded (no later priced event) -> basis stays 2024 $8, escalates 2 yrs
  expect(t).toMatchObject({ acquiredVia: "auction", acquisitionCost: 8, acquisitionSeason: "2024", yearsKept: 2 });
});

test("rookie pick recorded with slot; dollarized later", () => {
  const [r] = buildProvenance(["p_rook1"], chain, draftIndex(), faabIndex(), "2026");
  expect(r).toMatchObject({ acquiredVia: "rookie", acquisitionCost: 0, acquisitionSeason: "2024", yearsKept: 2 });
  expect(r!.rookiePick).toEqual({ round: 1, slot: 11 });
});

test("in-season FAAB beats same-season auction; classifies free agent + unknown", () => {
  const prov = buildProvenance(["p_wr1", "p_fa1", "ghost"], chain, draftIndex(), faabIndex(), "2026");
  const byId = Object.fromEntries(prov.map((p) => [p.playerId, p]));
  // p_wr1 auctioned 2024 ($22) but re-added via waiver 2025 ($17) -> faab wins
  expect(byId["p_wr1"]).toMatchObject({ acquiredVia: "faab", acquisitionCost: 17, acquisitionSeason: "2025" });
  expect(byId["p_fa1"]).toMatchObject({ acquiredVia: "free_agent", acquisitionCost: 0 });
  expect(byId["ghost"]).toMatchObject({ acquiredVia: "unknown", costKnown: false });
});
