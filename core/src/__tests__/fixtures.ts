// Tiny hand-made fixtures for offline unit tests. Not real league data.

import type { RawDraftPick, RawRoster, RawTransaction, RawUser } from "../sleeper/client";
import type { SeasonLink } from "../types";

export const users: RawUser[] = [
  { user_id: "u1", display_name: "alice", avatar: "a1", metadata: { team_name: "EBITDAwgs" } },
  { user_id: "u2", display_name: "bob", avatar: "a2", metadata: { team_name: "Blotter trotters" } },
  { user_id: "u3", display_name: "carol", avatar: null, metadata: null },
];

export const rosters: RawRoster[] = [
  {
    roster_id: 1,
    owner_id: "u1",
    players: ["p_qb1", "p_rb1", "p_wr1"],
    starters: ["p_qb1", "p_rb1", "0"],
    taxi: ["p_rook1"],
    reserve: null,
    settings: { wins: 8, losses: 5, ties: 0 },
  },
  {
    roster_id: 2,
    owner_id: "u2",
    players: ["p_te1"],
    starters: ["p_te1"],
    taxi: null,
    reserve: null,
    settings: { wins: 6, losses: 7, ties: 0 },
  },
  {
    roster_id: 3,
    owner_id: null,
    players: [],
    starters: null,
    taxi: null,
    reserve: null,
    settings: null,
  },
];

export const picks2025: RawDraftPick[] = [
  { player_id: "p_qb1", picked_by: "u1", roster_id: 1, round: 1, is_keeper: null, metadata: { amount: "45" } },
  { player_id: "p_rb1", picked_by: "u1", roster_id: 1, round: 1, is_keeper: null, metadata: { amount: "30" } },
  { player_id: "p_te1", picked_by: "u2", roster_id: 2, round: 2, is_keeper: null, metadata: { amount: "9" } },
];

export const picks2024: RawDraftPick[] = [
  { player_id: "p_wr1", picked_by: "u1", roster_id: 1, round: 1, is_keeper: null, metadata: { amount: "22" } },
  // p_rb1 was cheaper in 2024; provenance must prefer the 2025 re-acquisition (§6.3)
  { player_id: "p_rb1", picked_by: "u1", roster_id: 1, round: 1, is_keeper: null, metadata: { amount: "12" } },
  // p_trade1 auctioned in 2024 by u2, later traded to u1 — never re-drafted. Basis must carry.
  { player_id: "p_trade1", picked_by: "u2", roster_id: 2, round: 1, is_keeper: null, metadata: { amount: "8" } },
];

// Rookie/linear draft: no `amount`, cost derived from (round, draft_slot).
export const rookiePicks2024: RawDraftPick[] = [
  { player_id: "p_rook1", picked_by: "u1", roster_id: 1, round: 1, pick_no: 11, draft_slot: 11, is_keeper: null, metadata: { first_name: "Ladd", last_name: "McConkey" } },
  { player_id: "p_rook2", picked_by: "u2", roster_id: 2, round: 2, pick_no: 13, draft_slot: 1, is_keeper: null, metadata: {} },
];

export const txns2025: RawTransaction[] = [
  { type: "waiver", status: "complete", adds: { p_wr1: 1 }, settings: { waiver_bid: 17 } },
  { type: "free_agent", status: "complete", adds: { p_fa1: 1 }, settings: null },
  { type: "waiver", status: "failed", adds: { p_ignored: 1 }, settings: { waiver_bid: 99 } },
  { type: "trade", status: "complete", adds: { p_traded: 2 }, settings: null },
];

export const chain: SeasonLink[] = [
  { season: "2026", leagueId: "L2026", draftId: "D2026" },
  { season: "2025", leagueId: "L2025", draftId: "D2025" },
  { season: "2024", leagueId: "L2024", draftId: "D2024" },
];
