import type { AcqEvent, DraftIndex, SeasonLink } from "../types";
import type { RawDraftPick } from "../sleeper/client";
import { sleeper } from "../sleeper/client";

/**
 * Index one draft's picks into player -> AcqEvent.
 * - Auction picks carry `metadata.amount` -> auction event.
 * - Linear/rookie picks have no amount -> rookie event keyed by (round, draft_slot).
 * Pure.
 */
export function indexPicks(picks: RawDraftPick[]): Map<string, AcqEvent> {
  const m = new Map<string, AcqEvent>();
  for (const p of picks) {
    if (!p.player_id) continue;
    const raw = p.metadata?.amount;
    // Guard the empty string explicitly: Number("") === 0, not NaN.
    if (raw !== undefined && raw !== "") {
      const amount = Number(raw);
      if (Number.isFinite(amount)) {
        m.set(p.player_id, { source: "auction", amount, isKeeper: p.is_keeper === true });
        continue;
      }
    }
    // No auction amount: treat as a rookie/linear pick if we have a slot.
    if (typeof p.round === "number" && typeof p.draft_slot === "number") {
      m.set(p.player_id, { source: "rookie", round: p.round, slot: p.draft_slot });
    }
  }
  return m;
}

/** Prefer an auction event over a rookie one if a player somehow appears in both the same season. */
function mergePreferAuction(into: Map<string, AcqEvent>, from: Map<string, AcqEvent>): void {
  for (const [pid, ev] of from) {
    const existing = into.get(pid);
    if (!existing || (existing.source === "rookie" && ev.source === "auction")) into.set(pid, ev);
  }
}

/**
 * Build a season -> player -> AcqEvent index across ALL drafts in each season
 * (every auction AND the linear rookie draft), not just `league.draft_id`.
 */
export async function buildDraftIndex(chain: SeasonLink[]): Promise<DraftIndex> {
  const index: DraftIndex = new Map();
  for (const link of chain) {
    const drafts = (await sleeper.getDrafts(link.leagueId)) ?? [];
    const seasonMap = new Map<string, AcqEvent>();
    for (const d of drafts) {
      const picks = (await sleeper.getDraftPicks(d.draft_id)) ?? [];
      mergePreferAuction(seasonMap, indexPicks(picks));
    }
    index.set(link.season, seasonMap);
  }
  return index;
}
