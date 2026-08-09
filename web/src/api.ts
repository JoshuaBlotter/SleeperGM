// Typed client for the Express API. Shapes mirror the server responses (kept local to avoid bundling
// the Node-only core into the browser).

export interface TeamRow {
  rosterId: number;
  teamName: string;
  manager: string;
  wins: number;
  losses: number;
  ties: number;
  players: number;
  taxi: number;
}
export interface LeagueResp {
  season: string;
  capBudget: number;
  multiplier: number;
  valueSource?: string;
  sources?: string[];
  updatedAt?: string; // ISO — snapshot build time (static) or cache time (server)
  teams: TeamRow[];
}

export interface KeeperLine {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  acquiredVia: string;
  rookiePick?: { round: number; slot: number };
  baseCost: number;
  yearsKept: number;
  keeperCostNextYear: number;
  worth: number;
  surplus: number;
  recommendation: "keep" | "hold" | "cut";
  salarySource: "sheet" | "computed";
  approximate: boolean;
  costKnown: boolean;
}
export interface TeamResp {
  rosterId: number;
  teamName: string;
  manager: string;
  record: { wins: number; losses: number; ties: number };
  inflated: boolean;
  multiplier: number;
  cap: { budget: number; used: number; available: number };
  lines: KeeperLine[];
}

export interface Discount {
  name: string;
  position: string;
  teamName: string;
  worth: number;
  salary: number;
  surplus: number;
}
export interface TeamSurplus {
  teamId: number;
  teamName: string;
  keptCount: number;
  salaries: number;
  worth: number;
  surplus: number;
}
export interface InflationResp {
  capTotal: number;
  numTeams: number;
  calibration: number;
  keptCount: number;
  releasedCount: number;
  keeperSalaries: number;
  keeperWorth: number;
  keeperSurplus: number;
  auctionMoney: number;
  auctionValue: number;
  multiplier: number;
  perTeam: TeamSurplus[];
  topDiscounts: Discount[];
}

export interface DraftValueRow {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  cost: number;
  worth: number;
  delta: number;
  deltaPct: number | null;
  kept: boolean;
  ownerTeam: string | null;
  keeperCost: number | null;
}
export interface DraftValueReport {
  auctionSeason: string;
  projectionSeason: string;
  rows: DraftValueRow[];
  totalCost: number;
  totalWorth: number;
}

export interface ScarcityPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  value: number;
  kept: boolean;
}
export interface PositionScarcity {
  position: string;
  topN: number;
  players: ScarcityPlayer[];
  keptCount: number;
  availableCount: number;
  keptValue: number;
  availableValue: number;
  scarcityScore: number;
  bestAvailable: ScarcityPlayer | null;
}

export interface TierPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  value: number;
}
export interface Tier {
  tier: number;
  label: string;
  minValue: number;
  maxValue: number;
  players: TierPlayer[];
}
export interface TierBoard {
  byPosition: Record<string, Tier[]>;
  overall: Tier[];
}

export interface TradePlayer {
  playerId: string;
  name: string;
  position: string;
  teamId: number;
  teamName: string;
  worth: number;
  salary: number;
  surplus: number;
}
export interface Swap {
  give: TradePlayer;
  get: TradePlayer;
  myGain: number;
  capRelief: number;
  myFillsNeed: boolean;
  partnerFillsNeed: boolean;
}
export interface TradeResp {
  myChips: TradePlayer[];
  myDeadWeight: TradePlayer[];
  targets: TradePlayer[];
  myNeeds: { position: string; need: number }[];
  fairSwaps: Swap[];
  swaps: Swap[];
}

// Player facts for the Players page — rostered players + relevant free agents (source-independent).
export interface PlayerRow {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  rostered: boolean;
  teamId: number | null;
  teamName: string | null; // fantasy team, or null for a free agent
  lastSeasonPoints: number | null;
  yearsInLeague: number | null;
  keeperCostNextYear: number | null;
  baseCost: number | null;
  costKnown: boolean;
  salarySource: "sheet" | "computed" | null;
  approximate: boolean;
  acquiredVia: string | null;
}
export interface TrendingRow {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  count: number;
  rostered: boolean;
  teamName: string | null;
  lastSeasonPoints: number | null;
}
export interface PlayersResp {
  players: PlayerRow[];
  trending: TrendingRow[];
}

export interface RulesResp {
  rules: {
    capBudget: number;
    maxKeepers: number;
    keeperEscalation: { positionalBase: Record<string, number>; flatIncrease: number; flatPositions: string[]; floor: number };
    rookieCost: { table: Record<string, Record<string, number>>; floor: number };
    taxiCountsAgainstCap: boolean;
    irCountsAgainstCap: boolean;
    resetCostOnReacquire: boolean;
  };
  outstanding: string[];
}

export interface RookiePick {
  round: number;
  pickInRound: number;
  overall: number;
  label: string;
  slot: number;
  originalRosterId: number;
  originalTeam: string;
  ownerRosterId: number;
  ownerTeam: string;
  traded: boolean;
  viaTeam: string | null;
  cost: Record<string, number>;
}
export interface PlayerGrade {
  games: number;
  total: number;
  ppg: number;
  median: number;
  best: number;
  worst: number;
  stdev: number;
  cv: number;
  boomCount: number;
  bustCount: number;
  boomLine: number;
  bustLine: number;
  maxShare: number;
  grade: "A" | "B" | "C";
  archetype: "league-winner" | "consistent" | "steady" | "boom-bust" | "one-week-wonder" | "injury-limited";
}
export interface SeasonFinish {
  season: string;
  position: string;
  rank: number;
  points: number;
}
export interface PlayerDetail {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  season: string;
  weekly: number[];
  grade: PlayerGrade;
  finishes: SeasonFinish[];
  rostered: boolean;
  teamName: string | null;
  keeperCost: number | null;
}

export interface RookieProspect {
  rank: number;
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  value: number;
}
export interface RookieBoard {
  season: string;
  rounds: number;
  snake: boolean;
  derived: boolean;
  orderBasis: string;
  baseOrder: { slot: number; rosterId: number; teamName: string; wins: number; losses: number; ties: number; pointsFor: number }[];
  picks: RookiePick[];
  byTeam: { rosterId: number; teamName: string; picks: string[]; extra: number }[];
  prospects: RookieProspect[];
  prospectSource: string;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Two modes, decided once at runtime:
//  - "static": a prebuilt ./data.json is present (GitHub Pages) — everything is served from it, no server.
//  - "server": no snapshot — talk to the live Express API at /api/* (local dev).
// Value-dependent view models are baked per value source under `bySource`; the active source is chosen
// client-side (see the source dropdown), defaulting to `league.defaultSource`.
interface SourceData {
  multiplier: number;
  valueSource: string;
  teams: Record<string, { base: TeamResp; inflated: TeamResp }>;
  inflation: InflationResp;
  trades: Record<string, TradeResp>;
  draftValue: DraftValueReport;
  scarcity: PositionScarcity[];
  tiers: TierBoard;
}
interface Bundle {
  generatedAt?: string;
  league: { season: string; capBudget: number; sources: string[]; defaultSource: string; teams: TeamRow[] };
  bySource: Record<string, SourceData>;
  players: PlayersResp;
  playerDetails: Record<string, PlayerDetail>;
  rules: RulesResp;
  rookies: RookieBoard;
}
let bundle: Bundle | null | undefined;

/** Pick the source block from the bundle, falling back to the default when an unknown source is asked. */
function pickSource(b: Bundle, source?: string): SourceData {
  return b.bySource[source ?? b.league.defaultSource] ?? b.bySource[b.league.defaultSource]!;
}
const qs = (source?: string) => (source ? `source=${encodeURIComponent(source)}` : "");
async function getBundle(): Promise<Bundle | null> {
  if (bundle !== undefined) return bundle;
  try {
    const res = await fetch("./data.json", { cache: "no-cache" });
    bundle = res.ok ? ((await res.json()) as Bundle) : null;
  } catch {
    bundle = null;
  }
  return bundle;
}

function filterTrades(t: TradeResp, partner?: string): TradeResp {
  if (!partner) return t;
  const pid = Number(partner);
  return {
    ...t,
    targets: t.targets.filter((p) => p.teamId === pid),
    fairSwaps: t.fairSwaps.filter((s) => s.get.teamId === pid),
    swaps: t.swaps.filter((s) => s.get.teamId === pid),
  };
}

export const api = {
  staticMode: async (): Promise<boolean> => !!(await getBundle()),
  league: async (source?: string): Promise<LeagueResp> => {
    const b = await getBundle();
    if (b) {
      const sd = pickSource(b, source);
      return { season: b.league.season, capBudget: b.league.capBudget, teams: b.league.teams, sources: b.league.sources, valueSource: sd.valueSource, multiplier: sd.multiplier, updatedAt: b.generatedAt };
    }
    return get<LeagueResp>(`/api/league${qs(source) ? `?${qs(source)}` : ""}`);
  },
  team: async (id: number, inflated: boolean, source?: string) => {
    const b = await getBundle();
    if (b) {
      const t = pickSource(b, source).teams[id]!;
      return inflated ? t.inflated : t.base;
    }
    return get<TeamResp>(`/api/team/${id}?inflated=${inflated ? 1 : 0}&${qs(source)}`);
  },
  inflation: async (source?: string) => {
    const b = await getBundle();
    if (b) return pickSource(b, source).inflation;
    return get<InflationResp>(`/api/inflation${qs(source) ? `?${qs(source)}` : ""}`);
  },
  draftValue: async (source?: string): Promise<DraftValueReport> => {
    const b = await getBundle();
    if (b) return pickSource(b, source).draftValue;
    return get<DraftValueReport>(`/api/draft-value${qs(source) ? `?${qs(source)}` : ""}`);
  },
  scarcity: async (source?: string): Promise<PositionScarcity[]> => {
    const b = await getBundle();
    if (b) return pickSource(b, source).scarcity ?? [];
    return (await get<{ positions: PositionScarcity[] }>(`/api/scarcity${qs(source) ? `?${qs(source)}` : ""}`)).positions;
  },
  tiers: async (source?: string): Promise<TierBoard> => {
    const b = await getBundle();
    if (b) return pickSource(b, source).tiers;
    return get<TierBoard>(`/api/tiers${qs(source) ? `?${qs(source)}` : ""}`);
  },
  trades: async (id: number, partner?: string, source?: string) => {
    const b = await getBundle();
    if (b) return filterTrades(pickSource(b, source).trades[id]!, partner);
    const query = [partner ? `partner=${encodeURIComponent(partner)}` : "", qs(source)].filter(Boolean).join("&");
    return get<TradeResp>(`/api/trades/${id}${query ? `?${query}` : ""}`);
  },
  players: async (): Promise<PlayerRow[]> => {
    const b = await getBundle();
    if (b) return b.players.players;
    return (await get<{ players: PlayerRow[] }>("/api/players")).players;
  },
  trending: async (): Promise<TrendingRow[]> => {
    const b = await getBundle();
    if (b) return b.players.trending ?? [];
    return (await get<{ trending: TrendingRow[] }>("/api/trending")).trending;
  },
  rules: async () => (await getBundle())?.rules ?? get<RulesResp>("/api/rules"),
  rookies: async () => (await getBundle())?.rookies ?? get<RookieBoard>("/api/rookies"),
  playerDetails: async (): Promise<Record<string, PlayerDetail>> => {
    const b = await getBundle();
    if (b) return b.playerDetails ?? {};
    return (await get<{ details: Record<string, PlayerDetail> }>("/api/player-details")).details;
  },
  refresh: async () => {
    if (await getBundle()) return; // static snapshot — re-run `npm run snapshot` to update
    await fetch("/api/refresh", { method: "POST" });
  },
};
