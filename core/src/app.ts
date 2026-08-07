// Orchestration: compose the pure engines with live (cached) data into view models.
// Network-touching glue lives here (not in the pure engines) and is shared by the CLI and the server.

import { accumulatedSalary, baseSalary, yearIncrement } from "./engines/keepers";
import { buildAcquisitionIndex, leagueEntrySeason, ownerTenureStart } from "./history/tenure";
import { buildChain } from "./history/chain";
import { buildDraftIndex } from "./history/prices";
import { buildFaabIndex } from "./history/waivers";
import { buildProvenance } from "./history/provenance";
import { computeInflation, type InflationPlayer, type InflationResult } from "./engines/inflation";
import { computeRookieBoard, rankRookieProspects, type RookieBoard, type RookieProspect, type StandingRow, type TradedPick } from "./engines/rookies";
import { findTeam, loadRegistry } from "./registry/teams";
import { recommendation, toSurplusLines } from "./engines/surplus";
import { loadSalarySheet, sheetSalary, sheetSupersededByReacquire } from "./config/salaries";
import { leagueRules, rookieSlotCost } from "./config/league-rules";
import { loadResolver } from "./sleeper/players";
import { seasonPoints } from "./engines/points";
import { sleeper } from "./sleeper/client";
import { valuePlayers } from "./engines/valuation";
import { getActiveSource, listValueSources, loadOverrides, loadValueMap, valueSourceExists } from "./values/load";
import type { KeeperLine, PlayerLite, Provenance, SeasonLink, SurplusLine, Team, ValueLine } from "./types";

export interface Ctx {
  leagueId: string;
  season: string;
  chain: SeasonLink[];
  registry: Team[];
  rosterPositions: string[];
  resolve: (id: string) => PlayerLite;
}

export async function loadContext(leagueId: string): Promise<Ctx> {
  const [league, registry, resolver, chain] = await Promise.all([
    sleeper.getLeague(leagueId),
    loadRegistry(leagueId),
    loadResolver(),
    buildChain(leagueId),
  ]);
  if (!league) throw new Error(`League ${leagueId} not found`);
  return {
    leagueId,
    season: league.season,
    chain,
    registry,
    rosterPositions: league.roster_positions ?? [],
    resolve: (id) => resolver.resolve(id),
  };
}

export function pickTeam(ctx: Ctx, query: string): Team {
  const t = findTeam(ctx.registry, query);
  if (!t) {
    const names = ctx.registry.map((r) => `${r.rosterId}:${r.teamName}`).join(", ");
    throw new Error(`No team matches "${query}". Available: ${names}`);
  }
  return t;
}

/** Heavy, league-wide data built ONCE and reused across every team. */
export interface KeeperData {
  drafts: Awaited<ReturnType<typeof buildDraftIndex>>;
  faab: Awaited<ReturnType<typeof buildFaabIndex>>;
  acq: Awaited<ReturnType<typeof buildAcquisitionIndex>>;
  values: Map<string, ValueLine>;
  points: Map<string, number>; // last completed season's total fantasy points per player
  sheet: ReturnType<typeof loadSalarySheet>;
}

export async function loadKeeperData(ctx: Ctx): Promise<KeeperData> {
  const points = await loadLastSeasonPoints(ctx);
  const [drafts, faab, acq, values] = await Promise.all([
    buildDraftIndex(ctx.chain),
    buildFaabIndex(ctx.chain),
    buildAcquisitionIndex(ctx.chain),
    loadValues(ctx, getActiveSource(), points),
  ]);
  return { drafts, faab, acq, values, points, sheet: loadSalarySheet() };
}

/** Return the same KeeperData with values recomputed for a different value source (snapshot uses this). */
export async function withValueSource(ctx: Ctx, data: KeeperData, source: string): Promise<KeeperData> {
  return { ...data, values: await loadValues(ctx, source, data.points) };
}

/** Last completed season's fantasy points per player (the projection proxy the VORP model uses). */
async function loadLastSeasonPoints(ctx: Ctx): Promise<Map<string, number>> {
  const prevSeason = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  const isHistorical = prevSeason?.leagueId !== ctx.leagueId;
  return seasonPoints(prevSeason?.leagueId ?? ctx.leagueId, 17, isHistorical);
}

/** Per-player keeper cost lines for a team (provenance + owner tenure + salary replay/override). */
export function teamKeeperLines(ctx: Ctx, data: KeeperData, team: Team): KeeperLine[] {
  const { drafts, faab, acq, sheet, points } = data;
  const prov = buildProvenance(team.players, ctx.chain, drafts, faab, ctx.season);
  const currentYear = Number(ctx.season);
  const oldestSeason = Number(ctx.chain[ctx.chain.length - 1]?.season);

  return prov.map((p): KeeperLine => {
    const pl = ctx.resolve(p.playerId);

    const lastSeasonPoints = points.has(p.playerId) ? Math.round((points.get(p.playerId) as number) * 10) / 10 : null;
    const entrySeason = leagueEntrySeason(p.playerId, ctx.chain, acq);
    const yearsInLeague = entrySeason ? currentYear - Number(entrySeason) + 1 : null;
    const facts = { lastSeasonPoints, yearsInLeague };

    const tenureStart = Number(ownerTenureStart(p.playerId, team.ownerUserId, ctx.chain, acq) ?? p.acquisitionSeason);
    const originSeason = Number(p.acquisitionSeason);
    const yearsKept = Number.isFinite(tenureStart) ? Math.max(0, currentYear - tenureStart) : p.yearsKept;

    // 1) Authoritative salary sheet wins — UNLESS re-acquired (auction/FAAB) in the sheet's season or later.
    const superseded = sheet ? sheetSupersededByReacquire(sheet.season, p.acquisitionSeason, p.acquiredVia) : false;
    const entry = superseded ? undefined : sheetSalary(sheet, p.playerId, pl.name);
    if (entry && sheet) {
      let cost = entry.salary;
      let yk = entry.yearsKept ?? Math.max(0, sheet.season - (Number.isFinite(tenureStart) ? tenureStart : sheet.season));
      for (let year = sheet.season + 1; year <= currentYear; year++) {
        yk += 1;
        cost += yearIncrement(pl.position, yk, leagueRules);
      }
      cost = Math.max(leagueRules.keeperEscalation.floor, Math.round(cost));
      return line(p, pl, { base: entry.salary, cost, yearsKept: yk, isPlaceholder: false, source: "sheet", approximate: false, ...facts });
    }

    // 2) Compute: replay accumulated salary, carrying through the trade to the current owner.
    const { base, isPlaceholder } = baseSalary(p, pl.position, leagueRules);
    const stintStarts = [originSeason, tenureStart];
    const cost = accumulatedSalary({ originSeason, originCost: base, position: pl.position, stintStarts, throughSeason: currentYear });

    const acquiredSalary = accumulatedSalary({
      originSeason,
      originCost: base,
      position: pl.position,
      stintStarts: [originSeason],
      throughSeason: Math.max(originSeason, tenureStart),
    });

    const traded = tenureStart !== originSeason;
    const preSleeperRisk = p.acquiredVia === "auction" && originSeason === oldestSeason;
    return line(p, pl, { base: acquiredSalary, cost, yearsKept, isPlaceholder, source: "computed", approximate: p.costKnown && (traded || preSleeperRisk), ...facts });
  });
}

function line(
  p: Provenance,
  pl: PlayerLite,
  x: {
    base: number;
    cost: number;
    yearsKept: number;
    isPlaceholder: boolean;
    source: "sheet" | "computed";
    approximate: boolean;
    lastSeasonPoints: number | null;
    yearsInLeague: number | null;
  },
): KeeperLine {
  return {
    ...p,
    yearsKept: x.yearsKept,
    name: pl.name,
    position: pl.position,
    nflTeam: pl.team,
    baseCost: x.base,
    keeperCostNextYear: x.cost,
    keeperCostIsPlaceholder: x.isPlaceholder,
    salarySource: x.source,
    approximate: x.approximate,
    lastSeasonPoints: x.lastSeasonPoints,
    yearsInLeague: x.yearsInLeague,
  };
}

/**
 * Player "worth" ($). The VORP model is the always-available baseline; if a value SOURCE is active
 * (e.g. an imported ADP/expert auction list in config/values/), its values overlay VORP, and manual
 * overrides win over everything. `worthSource()` reports which source is in effect.
 */
export async function loadValues(
  ctx: Ctx,
  source: string = getActiveSource(),
  points?: Map<string, number>,
): Promise<Map<string, ValueLine>> {
  const league = await sleeper.getLeague(ctx.leagueId);
  const pts = points ?? (await loadLastSeasonPoints(ctx));
  const meta = new Map<string, PlayerLite>();
  for (const id of pts.keys()) meta.set(id, ctx.resolve(id));
  const vorp = valuePlayers({
    pointsByPlayer: pts,
    meta,
    rosterPositions: league?.roster_positions ?? [],
    numTeams: league?.total_rosters ?? ctx.registry.length,
    budget: leagueRules.capBudget,
  });

  const players = (await sleeper.getPlayers()) ?? {};
  if (source === "vorp") return applyOverrides(vorp, players);

  // Overlay the active source on the VORP fallback (source wins where it has a player).
  const { byId } = loadValueMap(source, players);
  const out = new Map(vorp);
  for (const [id, value] of byId) out.set(id, { playerId: id, points: 0, par: 0, value });
  return applyOverrides(out, players);
}

function applyOverrides(map: Map<string, ValueLine>, players: Record<string, import("./sleeper/client").RawPlayer>) {
  for (const [id, value] of loadOverrides(players)) map.set(id, { playerId: id, points: 0, par: 0, value });
  return map;
}

/** Which worth source is active (for display / default). */
export function worthSource(): string {
  return getActiveSource();
}

/** All selectable worth sources: the built-in "vorp" model plus every CSV in config/values/. */
export function worthSources(): string[] {
  return Array.from(new Set(["vorp", ...listValueSources()]));
}

export function teamSurplusBoard(ctx: Ctx, data: KeeperData, team: Team): SurplusLine[] {
  return toSurplusLines(teamKeeperLines(ctx, data, team), data.values);
}

export const STREAMER_POSITIONS = new Set(["K", "DEF"]);

/** League-wide inflation from keeper surplus (K/DEF excluded — streamed for ~$0). */
export function leagueInflation(ctx: Ctx, data: KeeperData): InflationResult {
  const players: InflationPlayer[] = [];
  for (const t of ctx.registry) {
    for (const l of teamSurplusBoard(ctx, data, t)) {
      if (STREAMER_POSITIONS.has(l.position)) continue;
      players.push({ name: l.name, position: l.position, teamId: t.rosterId, teamName: t.teamName, worth: l.worth, salary: l.keeperCostNextYear });
    }
  }
  return computeInflation(players, leagueRules.capBudget, ctx.registry.length);
}

/**
 * Rookie draft prep board (M6). Base order = reverse of last season's regular-season standings; current
 * ownership from this season's traded_picks. Sleeper doesn't publish the order, so this is derived.
 * Independent of value source and keeper data.
 */
export async function loadRookieBoard(ctx: Ctx): Promise<RookieBoard> {
  const prev = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  const prevLeagueId = prev?.leagueId ?? ctx.leagueId;

  const [prevRosters, prevUsers, rawTraded] = await Promise.all([
    sleeper.getRosters(prevLeagueId),
    sleeper.getUsers(prevLeagueId),
    sleeper.getTradedPicks(ctx.leagueId),
  ]);

  // Prev-season display names (fallback if a roster isn't in the current registry).
  const prevName = new Map<number, string>();
  const userName = new Map(
    (prevUsers ?? []).map((u) => [u.user_id, u.metadata?.team_name || u.display_name] as const),
  );
  for (const r of prevRosters ?? []) if (r.owner_id) prevName.set(r.roster_id, userName.get(r.owner_id) ?? `roster ${r.roster_id}`);

  const standings: StandingRow[] = (prevRosters ?? []).map((r) => ({
    rosterId: r.roster_id,
    teamName: prevName.get(r.roster_id) ?? `roster ${r.roster_id}`,
    wins: r.settings?.wins ?? 0,
    losses: r.settings?.losses ?? 0,
    ties: r.settings?.ties ?? 0,
    pointsFor: (r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100,
  }));

  const tradedPicks: TradedPick[] = ((rawTraded ?? []) as RawTradedPick[])
    .filter((t) => String(t.season) === ctx.season)
    .map((t) => ({ round: t.round, season: String(t.season), rosterId: t.roster_id, ownerId: t.owner_id, previousOwnerId: t.previous_owner_id }));

  // Current ownership → current team names.
  const regName = new Map(ctx.registry.map((t) => [t.rosterId, t.teamName] as const));
  const nameOf = (rosterId: number) => regName.get(rosterId) ?? prevName.get(rosterId) ?? `roster ${rosterId}`;

  const board = computeRookieBoard({
    season: ctx.season,
    standings,
    tradedPicks,
    rounds: leagueRules.rookieDraft.rounds,
    snake: leagueRules.rookieDraft.snake,
    orderBasis: leagueRules.rookieDraft.orderBasis,
    nameOf,
    costFor: (slot, round) => rookieSlotCost(slot, round),
  });

  // Rank the incoming class by ADP if present (the natural draft-market signal), else the active source.
  const prospectSource = valueSourceExists("adp") ? "adp" : getActiveSource();
  const values = await loadValues(ctx, prospectSource, await loadLastSeasonPoints(ctx));
  board.prospects = await rookieProspects(ctx, values);
  board.prospectSource = prospectSource;
  return board;
}

interface RawTradedPick {
  round: number;
  season: string | number;
  roster_id: number;
  owner_id: number;
  previous_owner_id?: number;
}

/** A player row for the Players page — rostered players + relevant free agents (source-independent). */
export interface AllPlayerRow {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  rostered: boolean;
  teamId: number | null;
  teamName: string | null; // fantasy team, or null for a free agent
  lastSeasonPoints: number | null;
  yearsInLeague: number | null; // rostered only
  keeperCostNextYear: number | null; // rostered only
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
  count: number; // adds in the lookback window (Sleeper trending)
  rostered: boolean;
  teamName: string | null;
  lastSeasonPoints: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Every fantasy-relevant player: all rostered players (rich keeper data) PLUS relevant free agents.
 * "Relevant" = appears in the ADP value list OR scored ≥50 last season — this trims the ~11k-player
 * NFL dump (players/nfl, cached 24h) down to the couple hundred that matter. Source-independent.
 */
export async function loadAllPlayers(ctx: Ctx, data: KeeperData): Promise<AllPlayerRow[]> {
  const rows: AllPlayerRow[] = [];
  const rosteredIds = new Set<string>();
  for (const t of ctx.registry) {
    for (const l of teamKeeperLines(ctx, data, t)) {
      rosteredIds.add(l.playerId);
      rows.push({
        playerId: l.playerId, name: l.name, position: l.position, nflTeam: l.nflTeam,
        rostered: true, teamId: t.rosterId, teamName: t.teamName,
        lastSeasonPoints: l.lastSeasonPoints, yearsInLeague: l.yearsInLeague,
        keeperCostNextYear: l.keeperCostNextYear, baseCost: l.baseCost, costKnown: l.costKnown,
        salarySource: l.salarySource, approximate: l.approximate, acquiredVia: l.acquiredVia,
      });
    }
  }

  const players = (await sleeper.getPlayers()) ?? {};
  const source = valueSourceExists("adp") ? "adp" : getActiveSource();
  const relevant = new Set<string>();
  if (source !== "vorp") for (const id of loadValueMap(source, players).byId.keys()) relevant.add(id);
  for (const [id, pts] of data.points) if (pts >= 50) relevant.add(id);

  for (const id of relevant) {
    if (rosteredIds.has(id)) continue;
    const pl = ctx.resolve(id);
    rows.push({
      playerId: id, name: pl.name, position: pl.position, nflTeam: pl.team,
      rostered: false, teamId: null, teamName: null,
      lastSeasonPoints: data.points.has(id) ? round1(data.points.get(id) as number) : null,
      yearsInLeague: null, keeperCostNextYear: null, baseCost: null, costKnown: false,
      salarySource: null, approximate: false, acquiredVia: null,
    });
  }
  return rows;
}

/** Sleeper's trending adds (most-added players in the last 24h), resolved + tagged with ownership. */
export async function loadTrending(ctx: Ctx, data: KeeperData, limit = 25): Promise<TrendingRow[]> {
  const trend = (await sleeper.getTrendingAdds()) ?? [];
  const teamOf = new Map<string, string>();
  const rosteredIds = new Set<string>();
  for (const t of ctx.registry) for (const id of t.players) { teamOf.set(id, t.teamName); rosteredIds.add(id); }
  return trend.slice(0, limit).map((x) => {
    const pl = ctx.resolve(x.player_id);
    return {
      playerId: x.player_id, name: pl.name, position: pl.position, nflTeam: pl.team,
      count: x.count, rostered: rosteredIds.has(x.player_id), teamName: teamOf.get(x.player_id) ?? null,
      lastSeasonPoints: data.points.has(x.player_id) ? round1(data.points.get(x.player_id) as number) : null,
    };
  });
}

const ROOKIE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

/**
 * The incoming rookie class (Sleeper `years_exp === 0`) ranked by a value source. Value-dependent, so
 * the caller passes the active source's value map. Returns more than the 12 first-round slots so you
 * can see stretch prospects who might sneak into round 1.
 */
export async function rookieProspects(ctx: Ctx, values: Map<string, ValueLine>, limit = 60): Promise<RookieProspect[]> {
  void ctx;
  const players = (await sleeper.getPlayers()) ?? {};
  const rows = [];
  for (const [id, p] of Object.entries(players)) {
    if (p.years_exp !== 0) continue;
    const pos = (p.position ?? "").toUpperCase();
    if (!ROOKIE_POSITIONS.has(pos)) continue;
    if (!p.team || p.active === false) continue;
    rows.push({
      playerId: id,
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || id,
      position: pos,
      nflTeam: p.team ?? null,
      value: values.get(id)?.value ?? 0,
    });
  }
  return rankRookieProspects(rows, limit);
}

/** Re-rank a surplus board with inflation-adjusted worth (skill worth × multiplier; streamers unchanged). */
export function inflateBoard(board: SurplusLine[], multiplier: number): SurplusLine[] {
  return board
    .map((l): SurplusLine => {
      const worth = STREAMER_POSITIONS.has(l.position) ? l.worth : Math.round(l.worth * multiplier);
      const surplus = worth - l.keeperCostNextYear;
      return { ...l, worth, surplus, recommendation: recommendation(surplus, worth) };
    })
    .sort((a, b) => b.surplus - a.surplus);
}
