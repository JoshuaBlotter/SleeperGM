// Domain types (fully typed). Raw Sleeper payloads are typed loosely at the client boundary.

export interface PlayerLite {
  id: string;
  name: string;
  position: string; // QB, RB, WR, TE, K, DEF, ...
  team: string | null; // NFL team code, null if FA
  nflExperience: number | null; // completed NFL seasons (Sleeper years_exp); 0 = rookie, null if unknown
}

export type AcquiredVia = "auction" | "faab" | "free_agent" | "rookie" | "unknown";

export interface Provenance {
  playerId: string;
  acquiredVia: AcquiredVia;
  acquisitionCost: number; // whole dollars; 0 for rookie (dollarized later via schedule) / free / unknown
  acquisitionSeason: string | null;
  yearsKept: number; // approx: currentSeason - acquisitionSeason (see DECISIONS.md)
  costKnown: boolean;
  rookiePick?: { round: number; slot: number }; // set when acquiredVia === "rookie"
}

export interface Team {
  rosterId: number;
  ownerUserId: string | null;
  displayName: string;
  teamName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  players: string[];
  starters: string[];
  taxi: string[];
  reserve: string[];
}

export interface SeasonLink {
  season: string;
  leagueId: string;
  draftId: string | null;
}

export interface AcquisitionRecord {
  season: string;
  via: AcquiredVia;
  cost: number;
}

/** A priced acquisition event found in draft data. */
export type AcqEvent =
  | { source: "auction"; amount: number; isKeeper: boolean }
  | { source: "rookie"; round: number; slot: number };

export type DraftIndex = Map<string, Map<string, AcqEvent>>; // season -> player -> event
export type FaabIndex = Map<string, Map<string, number>>; // season -> player -> faab bid

export interface KeeperLine extends Provenance {
  name: string;
  position: string;
  nflTeam: string | null;
  baseCost: number; // origin salary basis (auction $, FAAB bid, or dollarized rookie pick)
  keeperCostNextYear: number;
  keeperCostIsPlaceholder: boolean;
  salarySource: "sheet" | "computed"; // "sheet" = from the authoritative salary override
  approximate: boolean; // true when the API can't fully reconstruct (traded and/or pre-2022 origin)
  lastSeasonPoints: number | null; // total fantasy points last season (null if didn't score / not found)
  yearsInLeague: number | null; // COUNT of seasons rostered in THIS fantasy league (any owner), null if never
  nflExperience: number | null; // completed NFL seasons — not the same thing, and often confused with it
}

export interface ValueLine {
  playerId: string;
  points: number;
  par: number; // points above replacement
  value: number; // projected auction dollars
  /**
   * Does the ACTIVE value source actually rank this player, or is this the VORP fallback?
   * The two are not on the same axis — VORP prices last season's realized points, an imported list
   * prices this season's market — so a fallback dollar must never be sorted against a sourced one.
   * Draft-board views (tiers, scarcity, targets) show only ranked players; see loadValues.
   */
  ranked: boolean;
}

export interface SurplusLine extends KeeperLine {
  worth: number; // valuation dollars
  surplus: number; // worth - keeperCostNextYear
  recommendation: "keep" | "hold" | "cut";
}
