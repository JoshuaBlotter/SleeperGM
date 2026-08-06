import type { Team } from "../types";
import type { RawRoster, RawUser } from "../sleeper/client";
import { sleeper } from "../sleeper/client";

/** Join rosters + users into the team registry. Pure — testable with fixtures. */
export function buildRegistry(rosters: RawRoster[], users: RawUser[]): Team[] {
  const usersById = new Map(users.map((u) => [u.user_id, u]));
  return rosters
    .map((r): Team => {
      const u = r.owner_id ? usersById.get(r.owner_id) : undefined;
      const teamName = u?.metadata?.team_name?.trim() || u?.display_name || `Team ${r.roster_id}`;
      return {
        rosterId: r.roster_id,
        ownerUserId: r.owner_id ?? null,
        displayName: u?.display_name ?? "(unknown)",
        teamName,
        avatar: u?.avatar ?? null,
        wins: r.settings?.wins ?? 0,
        losses: r.settings?.losses ?? 0,
        ties: r.settings?.ties ?? 0,
        players: r.players ?? [],
        starters: (r.starters ?? []).filter((p) => p && p !== "0"),
        taxi: r.taxi ?? [],
        reserve: r.reserve ?? [],
      };
    })
    .sort((a, b) => a.rosterId - b.rosterId);
}

/** Find a team by rosterId (numeric string) or a case-insensitive team/display-name substring. */
export function findTeam(registry: Team[], query: string): Team | undefined {
  const q = query.trim();
  if (/^\d+$/.test(q)) {
    const id = Number(q);
    const byId = registry.find((t) => t.rosterId === id);
    if (byId) return byId;
  }
  const lc = q.toLowerCase();
  return (
    registry.find((t) => t.teamName.toLowerCase() === lc || t.displayName.toLowerCase() === lc) ??
    registry.find(
      (t) => t.teamName.toLowerCase().includes(lc) || t.displayName.toLowerCase().includes(lc),
    )
  );
}

export async function loadRegistry(leagueId: string): Promise<Team[]> {
  const [rosters, users] = await Promise.all([sleeper.getRosters(leagueId), sleeper.getUsers(leagueId)]);
  return buildRegistry(rosters ?? [], users ?? []);
}
