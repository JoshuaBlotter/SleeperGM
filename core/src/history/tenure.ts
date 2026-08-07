import type { SeasonLink } from "../types";
import { sleeper } from "../sleeper/client";

/** season -> playerId -> set of user_ids who ACQUIRED that player that season (draft/waiver/trade). */
export type AcquisitionIndex = Map<string, Map<string, Set<string>>>;

/**
 * Build an index of who acquired each player each season, across all drafts and transactions.
 * `picked_by` (drafts) and owner (via roster_id on transaction `adds`) are stable user_ids.
 */
export async function buildAcquisitionIndex(chain: SeasonLink[]): Promise<AcquisitionIndex> {
  const index: AcquisitionIndex = new Map();
  for (const [i, link] of chain.entries()) {
    const historical = i > 0; // chain[0] is the current season; the rest are immutable
    const acq = new Map<string, Set<string>>();
    const add = (pid: string, uid: string | null | undefined) => {
      if (!pid || !uid) return;
      if (!acq.has(pid)) acq.set(pid, new Set());
      acq.get(pid)!.add(uid);
    };

    const drafts = (await sleeper.getDrafts(link.leagueId)) ?? [];
    for (const d of drafts) {
      const picks = (await sleeper.getDraftPicks(d.draft_id)) ?? [];
      for (const p of picks) add(p.player_id, p.picked_by);
    }

    const [rosters, users] = await Promise.all([
      sleeper.getRosters(link.leagueId),
      sleeper.getUsers(link.leagueId),
    ]);
    void users;
    const rosterToOwner = new Map<number, string>();
    for (const r of rosters ?? []) if (r.owner_id) rosterToOwner.set(r.roster_id, r.owner_id);

    for (let week = 1; week <= 18; week++) {
      const txns = (await sleeper.getTransactions(link.leagueId, week, historical)) ?? [];
      for (const t of txns) {
        if (t.status !== "complete" || !t.adds) continue;
        for (const [pid, rosterId] of Object.entries(t.adds)) add(pid, rosterToOwner.get(rosterId));
      }
    }

    index.set(link.season, acq);
  }
  return index;
}

/**
 * The earliest (oldest) season ANY owner acquired the player in this league chain = when the player
 * first entered the league. Used for "years in the league". Returns null if never seen in the index.
 * `chain` is newest-first, so we keep overwriting and the last hit is the oldest season present.
 */
export function leagueEntrySeason(playerId: string, chain: SeasonLink[], acq: AcquisitionIndex): string | null {
  let earliest: string | null = null;
  for (const link of chain) {
    if (acq.get(link.season)?.has(playerId)) earliest = link.season;
  }
  return earliest;
}

/**
 * The season the current owner most recently acquired the player = start of their tenure.
 * Returns null if no acquisition by that owner is found (caller falls back to cost-basis season).
 */
export function ownerTenureStart(
  playerId: string,
  ownerUserId: string | null,
  chain: SeasonLink[],
  acq: AcquisitionIndex,
): string | null {
  if (!ownerUserId) return null;
  for (const link of chain) {
    // chain is newest-first, so the first hit is the most recent acquisition
    if (acq.get(link.season)?.get(playerId)?.has(ownerUserId)) return link.season;
  }
  return null;
}
