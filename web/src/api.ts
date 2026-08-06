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
  teams: TeamRow[];
}

export interface KeeperLine {
  playerId: string;
  name: string;
  position: string;
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

export interface PlayerRow extends KeeperLine {
  teamId: number;
  teamName: string;
  acquisitionSeason: string | null;
}
export interface PlayersResp {
  players: PlayerRow[];
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
interface Bundle {
  league: LeagueResp;
  teams: Record<string, { base: TeamResp; inflated: TeamResp }>;
  inflation: InflationResp;
  players: PlayersResp;
  rules: RulesResp;
  trades: Record<string, TradeResp>;
}
let bundle: Bundle | null | undefined;
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
  league: async () => (await getBundle())?.league ?? get<LeagueResp>("/api/league"),
  team: async (id: number, inflated: boolean) => {
    const b = await getBundle();
    if (b) return inflated ? b.teams[id]!.inflated : b.teams[id]!.base;
    return get<TeamResp>(`/api/team/${id}?inflated=${inflated ? 1 : 0}`);
  },
  inflation: async () => (await getBundle())?.inflation ?? get<InflationResp>("/api/inflation"),
  trades: async (id: number, partner?: string) => {
    const b = await getBundle();
    if (b) return filterTrades(b.trades[id]!, partner);
    return get<TradeResp>(`/api/trades/${id}${partner ? `?partner=${encodeURIComponent(partner)}` : ""}`);
  },
  players: async () => (await getBundle())?.players ?? get<PlayersResp>("/api/players"),
  rules: async () => (await getBundle())?.rules ?? get<RulesResp>("/api/rules"),
  refresh: async () => {
    if (await getBundle()) return; // static snapshot — re-run `npm run snapshot` to update
    await fetch("/api/refresh", { method: "POST" });
  },
};
