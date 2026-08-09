import { expect, test } from "vitest";
import { computeDraftTargets, positionalNeeds, type TargetCandidate } from "../engines/draftTargets";

const c = (id: string, position: string, worth: number, nflTeam: string | null = "SF"): TargetCandidate => ({
  playerId: id, name: id, position, nflTeam, worth, tier: 1, ownerTeamId: null, projectedKeeper: false,
});

const slots = { QB: 1, RB: 2, WR: 2, TE: 1 };

test("positionalNeeds: starterSlots minus kept players at position (any worth counts)", () => {
  const kept = [
    { position: "RB" },
    { position: "RB" },
    { position: "WR" },
    { position: "QB" }, // a cheap kept QB still fills the QB slot (ADP undervalues QBs)
  ];
  const n = positionalNeeds(kept, slots);
  expect(n.RB).toBe(0); // 2 slots − 2 kept
  expect(n.WR).toBe(1); // 2 − 1
  expect(n.QB).toBe(0); // 1 − 1  ← keeping any QB zeroes the QB need
  expect(n.TE).toBe(1); // 1 − 0
});

test("need boosts, depth dampens (same worth ranks the need higher)", () => {
  const out = computeDraftTargets({
    candidates: [c("needRB", "RB", 40), c("depthWR", "WR", 40)],
    needs: { RB: 2, WR: -1 }, // short 2 RB, deep at WR
    keptQbs: [],
    teamCounts: {},
  });
  expect(out[0]!.playerId).toBe("needRB");
  expect(out[0]!.fillsNeed).toBe(true);
  expect(out[0]!.reasons).toContain("fills RB need");
  expect(out.find((t) => t.playerId === "depthWR")!.reasons).toContain("depth at WR");
});

test("QB stack bonus: pass-catcher on my kept QB's team is boosted + explained", () => {
  const out = computeDraftTargets({
    candidates: [c("wrBUF", "WR", 30, "BUF"), c("wrKC", "WR", 30, "KC")],
    needs: { WR: 1 },
    keptQbs: [{ name: "Josh Allen", nflTeam: "BUF" }],
    teamCounts: {},
  });
  const buf = out.find((t) => t.playerId === "wrBUF")!;
  const kc = out.find((t) => t.playerId === "wrKC")!;
  expect(buf.stack).toBe(true);
  expect(buf.score).toBeGreaterThan(kc.score);
  expect(buf.reasons.some((r) => r.includes("stacks with Josh Allen"))).toBe(true);
});

test("diversity penalty: over-concentrated NFL team is dinged", () => {
  const out = computeDraftTargets({
    candidates: [c("rbSF", "RB", 30, "SF"), c("rbDAL", "RB", 30, "DAL")],
    needs: { RB: 1 },
    keptQbs: [],
    teamCounts: { SF: 2 }, // already 2 kept from SF
  });
  const sf = out.find((t) => t.playerId === "rbSF")!;
  const dal = out.find((t) => t.playerId === "rbDAL")!;
  expect(sf.overStacked).toBe(true);
  expect(sf.score).toBeLessThan(dal.score);
  expect(sf.reasons.some((r) => r.includes("kept from SF"))).toBe(true);
});
