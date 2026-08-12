import { cached, clearCache } from "./cache";

const BASE = "https://api.sleeper.app/v1";
const MIN = 60_000;
const HOUR = 60 * MIN;

export const TTL = {
  players: 24 * HOUR,
  league: 10 * MIN,
  rosters: 10 * MIN,
  users: 15 * MIN,
  nfl: 30 * MIN,
  txns: 10 * MIN,
  matchups: 10 * MIN,
  permanent: 100 * 365 * 24 * HOUR,
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REQUEST_TIMEOUT_MS = 7000;
const MAX_TRIES = 3;

// Circuit breaker: once the API is judged unreachable for this run, fail fast so the cache layer can
// serve stale data immediately instead of grinding through ~200 timeouts.
let apiDown = false;

async function fetchOnce(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, attempt = 0): Promise<T | null> {
  if (apiDown) throw new Error(`Sleeper API unreachable this run (skipping ${url})`);
  try {
    const res = await fetchOnce(url);
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) throw new Error(`transient ${res.status}`);
    if (!res.ok) throw new Error(`Sleeper API ${res.status} ${res.statusText}`);
    const text = await res.text();
    if (!text || text === "null") return null;
    return JSON.parse(text) as T;
  } catch (err) {
    if (attempt < MAX_TRIES - 1) {
      await sleep(400 * 2 ** attempt); // 0.4s, 0.8s
      return fetchJson<T>(url, attempt + 1);
    }
    apiDown = true; // trip the breaker; remaining calls this run fail fast -> cache serves stale
    const cause = err instanceof Error && err.cause ? (err.cause as { code?: string; message?: string }) : undefined;
    const reason = cause?.code || cause?.message || (err instanceof Error ? err.message : String(err));
    throw new Error(`fetch failed for ${url} after ${MAX_TRIES} tries: ${reason}`);
  }
}

// --- Raw payload shapes (only the fields we consume) ---
export interface RawLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  previous_league_id: string | null;
  draft_id: string | null;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: Record<string, number>;
  total_rosters: number;
}
export interface RawRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  taxi: string[] | null;
  reserve: string[] | null;
  settings: { wins?: number; losses?: number; ties?: number; fpts?: number; fpts_decimal?: number } | null;
}
export interface RawUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string } | null;
}
export interface RawDraft {
  draft_id: string;
  season: string;
  type: string;
  settings: Record<string, number>;
}
export interface RawDraftPick {
  player_id: string;
  picked_by: string;
  roster_id: number;
  round: number;
  pick_no?: number;
  draft_slot?: number;
  is_keeper: boolean | null;
  metadata?: { amount?: string; position?: string; first_name?: string; last_name?: string } | null;
}
export interface RawTransaction {
  type: string; // "waiver" | "free_agent" | "trade"
  status: string; // "complete" | ...
  adds: Record<string, number> | null; // playerId -> rosterId
  roster_ids?: number[]; // rosters party to the transaction (both sides of a trade)
  settings: { waiver_bid?: number } | null;
}
export interface RawMatchup {
  roster_id: number;
  players_points: Record<string, number> | null;
}

export const sleeper = {
  async getNflState() {
    return cached(`nfl_state`, TTL.nfl, () =>
      fetchJson<{ season: string; week: number; previous_season: string }>(`${BASE}/state/nfl`),
    );
  },
  async getLeague(leagueId: string) {
    return cached(`league_${leagueId}`, TTL.league, () => fetchJson<RawLeague>(`${BASE}/league/${leagueId}`));
  },
  async getRosters(leagueId: string) {
    return cached(`rosters_${leagueId}`, TTL.rosters, () =>
      fetchJson<RawRoster[]>(`${BASE}/league/${leagueId}/rosters`),
    );
  },
  async getUsers(leagueId: string) {
    return cached(`users_${leagueId}`, TTL.users, () =>
      fetchJson<RawUser[]>(`${BASE}/league/${leagueId}/users`),
    );
  },
  async getDrafts(leagueId: string) {
    return cached(`drafts_${leagueId}`, TTL.league, () =>
      fetchJson<RawDraft[]>(`${BASE}/league/${leagueId}/drafts`),
    );
  },
  async getDraftPicks(draftId: string) {
    // Historical picks never change -> effectively permanent.
    return cached(`draftpicks_${draftId}`, TTL.permanent, () =>
      fetchJson<RawDraftPick[]>(`${BASE}/draft/${draftId}/picks`),
    );
  },
  // `historical` = a completed prior season, whose transactions/matchups never change -> cache forever.
  async getTransactions(leagueId: string, week: number, historical = false) {
    return cached(`txns_${leagueId}_${week}`, historical ? TTL.permanent : TTL.txns, () =>
      fetchJson<RawTransaction[]>(`${BASE}/league/${leagueId}/transactions/${week}`),
    );
  },
  async getMatchups(leagueId: string, week: number, historical = false) {
    return cached(`matchups_${leagueId}_${week}`, historical ? TTL.permanent : TTL.matchups, () =>
      fetchJson<RawMatchup[]>(`${BASE}/league/${leagueId}/matchups/${week}`),
    );
  },
  // Per-week fantasy stats for EVERY player (not just rostered), incl. `pts_ppr` + `gp`. Completed
  // seasons are immutable -> permanent cache. This is how we get true NFL game logs / season totals
  // regardless of who was rostered in the league.
  async getWeekStats(season: string, week: number) {
    return cached(`stats_${season}_${week}`, TTL.permanent, () =>
      fetchJson<Record<string, RawStat | null>>(`${BASE}/stats/nfl/regular/${season}/${week}`),
    );
  },
  async getTradedPicks(leagueId: string) {
    return cached(`tradedpicks_${leagueId}`, TTL.league, () =>
      fetchJson<unknown[]>(`${BASE}/league/${leagueId}/traded_picks`),
    );
  },
  async getPlayers() {
    return cached(`players_nfl`, TTL.players, () =>
      fetchJson<Record<string, RawPlayer>>(`${BASE}/players/nfl`),
    );
  },
  async getTrendingAdds() {
    return cached(`trending_add`, TTL.nfl, () =>
      fetchJson<{ player_id: string; count: number }[]>(`${BASE}/players/nfl/trending/add`),
    );
  },
  refresh: clearCache,
};

export interface RawStat {
  pts_ppr?: number | null;
  gp?: number | null; // games played that week (0 = did not play / bye)
}
export interface RawPlayer {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  team?: string | null;
  years_exp?: number | null; // 0 = incoming rookie
  active?: boolean;
}
