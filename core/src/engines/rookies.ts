// Rookie draft prep board (M6 · issue #1). PURE.
//
// Sleeper does NOT publish the upcoming rookie draft order (the only 2026 draft is the auction, whose
// slot_to_roster_id is identity). So we DERIVE the order from the reverse of last season's regular-season
// standings (worst record picks first), then apply Sleeper's traded_picks to show current ownership.

export interface StandingRow {
  rosterId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

/** A traded pick from Sleeper (/league/{id}/traded_picks). `rosterId` = the pick's ORIGINAL owner. */
export interface TradedPick {
  round: number;
  season: string;
  rosterId: number; // original owner (whose standings slot created the pick)
  ownerId: number; // current owner
  previousOwnerId?: number;
}

export interface BaseSlot {
  slot: number; // 1..N, 1 = worst record = first pick
  rosterId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

export interface RookiePick {
  round: number;
  pickInRound: number; // 1..teams, draft sequence position within the round (snake-aware)
  overall: number; // overall pick number across rounds
  label: string; // "1.01"
  slot: number; // the owning slot's reverse-standings rank (1..teams)
  originalRosterId: number;
  originalTeam: string;
  ownerRosterId: number;
  ownerTeam: string;
  traded: boolean;
  viaTeam: string | null; // originalTeam when traded (the pick's origin)
  cost: Record<string, number>; // position -> salary (round 1 only; {} when unknown)
}

export interface TeamCapital {
  rosterId: number;
  teamName: string;
  picks: string[]; // labels this team currently owns, in draft order
  extra: number; // net picks vs the default one-per-round (>0 = acquired, <0 = dealt away)
}

export interface RookieBoard {
  season: string;
  rounds: number;
  snake: boolean;
  derived: true; // always — Sleeper doesn't expose the order
  orderBasis: string;
  baseOrder: BaseSlot[];
  picks: RookiePick[];
  byTeam: TeamCapital[];
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Build the rookie draft board.
 * @param standings  last season's regular-season standings (any order; sorted here).
 * @param tradedPicks traded picks for the upcoming season (already filtered to that season).
 * @param nameOf     resolve a CURRENT-season roster id to its team name (ownership reflects today).
 * @param costFor    (slot, round) -> position→salary map (round 1 from the §6.4 table; else {}).
 */
export function computeRookieBoard(input: {
  season: string;
  standings: StandingRow[];
  tradedPicks: TradedPick[];
  rounds: number;
  snake: boolean;
  orderBasis: string;
  nameOf: (rosterId: number) => string;
  costFor: (slot: number, round: number) => Record<string, number>;
}): RookieBoard {
  const { season, standings, tradedPicks, rounds, snake, orderBasis, nameOf, costFor } = input;

  // Base order: reverse standings — worst record first (wins asc, then points-for asc as tiebreak).
  const sorted = [...standings].sort((a, b) => a.wins - b.wins || a.pointsFor - b.pointsFor || a.rosterId - b.rosterId);
  const teams = sorted.length;
  const baseOrder: BaseSlot[] = sorted.map((s, i) => ({
    slot: i + 1,
    rosterId: s.rosterId,
    teamName: nameOf(s.rosterId) || s.teamName,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
  }));

  // Ownership overrides: key "round:originalRosterId" -> current owner id.
  const owned = new Map<string, number>();
  for (const t of tradedPicks) owned.set(`${t.round}:${t.rosterId}`, t.ownerId);

  const picks: RookiePick[] = [];
  for (let round = 1; round <= rounds; round++) {
    // Snake: even rounds reverse the sequence, but pick OWNERSHIP is still per-team (their own slot).
    const sequence = snake && round % 2 === 0 ? [...baseOrder].reverse() : baseOrder;
    sequence.forEach((base, i) => {
      const pickInRound = i + 1;
      const overall = (round - 1) * teams + pickInRound;
      const ownerRosterId = owned.get(`${round}:${base.rosterId}`) ?? base.rosterId;
      const traded = ownerRosterId !== base.rosterId;
      picks.push({
        round,
        pickInRound,
        overall,
        label: `${round}.${pad2(pickInRound)}`,
        slot: base.slot,
        originalRosterId: base.rosterId,
        originalTeam: base.teamName,
        ownerRosterId,
        ownerTeam: nameOf(ownerRosterId) || `roster ${ownerRosterId}`,
        traded,
        viaTeam: traded ? base.teamName : null,
        cost: costFor(base.slot, round),
      });
    });
  }

  // Per-team capital: picks each team currently owns, in draft order.
  const byTeamMap = new Map<number, TeamCapital>();
  for (const b of baseOrder) byTeamMap.set(b.rosterId, { rosterId: b.rosterId, teamName: b.teamName, picks: [], extra: 0 });
  for (const p of picks) {
    if (!byTeamMap.has(p.ownerRosterId))
      byTeamMap.set(p.ownerRosterId, { rosterId: p.ownerRosterId, teamName: p.ownerTeam, picks: [], extra: 0 });
    byTeamMap.get(p.ownerRosterId)!.picks.push(p.label);
  }
  for (const cap of byTeamMap.values()) cap.extra = cap.picks.length - rounds;
  const byTeam = [...byTeamMap.values()].sort((a, b) => b.picks.length - a.picks.length || a.teamName.localeCompare(b.teamName));

  return { season, rounds, snake, derived: true, orderBasis, baseOrder, picks, byTeam };
}
