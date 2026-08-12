// Orchestration: compose the pure engines with live (cached) data into view models.
// Network-touching glue lives here (not in the pure engines) and is shared by the CLI and the server.

import { accumulatedSalary, baseSalary, yearIncrement } from "./engines/keepers";
import { buildAcquisitionIndex, buildPresenceIndex, ownerTenureStart, seasonsInLeague } from "./history/tenure";
import { buildChain } from "./history/chain";
import { buildDraftIndex } from "./history/prices";
import { buildFaabIndex } from "./history/waivers";
import { buildProvenance } from "./history/provenance";
import { computeInflation, type InflationPlayer, type InflationResult } from "./engines/inflation";
import { computeRookieBoard, rankRookieProspects, type RookieBoard, type RookieProspect, type StandingRow, type TradedPick } from "./engines/rookies";
import { buildDraftValueReport, type AuctionBuy, type DraftValueReport } from "./engines/draftValue";
import { computeScarcity, type PositionScarcity, type ScarcityPlayer } from "./engines/scarcity";
import { computeLeagueBrain, type LeagueBrain, type TeamBrainInput } from "./engines/leagueBrain";
import { bandize, tierize, type Tier, type TierPlayer } from "./engines/tiers";
import { startingSlots } from "./engines/trades";
import type { TargetCandidate } from "./engines/draftTargets";
import { findTeam, loadRegistry } from "./registry/teams";
import { recommendation, toSurplusLines } from "./engines/surplus";
import { loadSalarySheet, sheetSalary, sheetSupersededByReacquire } from "./config/salaries";
import { leagueRules, rookieSlotCost } from "./config/league-rules";
import { loadResolver } from "./sleeper/players";
import { seasonPoints, seasonWeeklyPoints, type WeekScore } from "./engines/points";
import { gradePlayer, type PlayerGrade } from "./engines/playerDetail";
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
  presence: Awaited<ReturnType<typeof buildPresenceIndex>>;
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
  // Needs `acq`, so it follows rather than joins the batch. Rosters are already cached by then.
  const presence = await buildPresenceIndex(ctx.chain, acq);
  return { drafts, faab, acq, presence, values, points, sheet: loadSalarySheet() };
}

/** Return the same KeeperData with values recomputed for a different value source (snapshot uses this). */
export async function withValueSource(ctx: Ctx, data: KeeperData, source: string): Promise<KeeperData> {
  return { ...data, values: await loadValues(ctx, source, data.points) };
}

/** Last completed season's fantasy points per player (the projection proxy the VORP model uses). */
async function loadLastSeasonPoints(ctx: Ctx): Promise<Map<string, number>> {
  const prevSeason = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  return seasonPoints(prevSeason?.season ?? ctx.season);
}

/** Last completed season's per-player weekly game log (for the drilldown). */
async function loadLastSeasonWeekly(ctx: Ctx): Promise<Map<string, WeekScore[]>> {
  const prevSeason = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  return seasonWeeklyPoints(prevSeason?.season ?? ctx.season);
}

/** Per-player keeper cost lines for a team (provenance + owner tenure + salary replay/override). */
export function teamKeeperLines(ctx: Ctx, data: KeeperData, team: Team): KeeperLine[] {
  const { drafts, faab, acq, presence, sheet, points } = data;
  const prov = buildProvenance(team.players, ctx.chain, drafts, faab, ctx.season);
  const currentYear = Number(ctx.season);
  const oldestSeason = Number(ctx.chain[ctx.chain.length - 1]?.season);

  return prov.map((p): KeeperLine => {
    const pl = ctx.resolve(p.playerId);

    const lastSeasonPoints = points.has(p.playerId) ? Math.round((points.get(p.playerId) as number) * 10) / 10 : null;
    const yearsInLeague = seasonsInLeague(p.playerId, ctx.chain, presence);
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
    nflExperience: pl.nflExperience,
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
  yearsInLeague: number | null; // seasons rostered in THIS league; rostered only
  nflExperience: number | null; // completed NFL seasons — known for free agents too
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
        lastSeasonPoints: l.lastSeasonPoints, yearsInLeague: l.yearsInLeague, nflExperience: l.nflExperience,
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
      yearsInLeague: null, nflExperience: pl.nflExperience, keeperCostNextYear: null, baseCost: null, costKnown: false,
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

/**
 * Historical draft value (#2): last season's auction buys (excluding carried keepers + rookie picks) vs
 * this season's projected worth. Value-dependent (worth comes from the active source in `data.values`).
 */
export function loadDraftValue(ctx: Ctx, data: KeeperData): DraftValueReport {
  const prev = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  const auctionSeason = prev?.season ?? ctx.season;
  const events = data.drafts.get(auctionSeason) ?? new Map();

  // Who's currently rostered (a potential keeper) + their keeper cost this season.
  const rostered = new Map<string, { teamName: string; keeperCost: number }>();
  for (const t of ctx.registry) {
    for (const l of teamKeeperLines(ctx, data, t)) rostered.set(l.playerId, { teamName: t.teamName, keeperCost: l.keeperCostNextYear });
  }

  const buys: AuctionBuy[] = [];
  for (const [id, ev] of events) {
    if (ev.source !== "auction" || ev.isKeeper) continue; // auction buys only; skip carried keepers & rookies
    const pl = ctx.resolve(id);
    const r = rostered.get(id);
    buys.push({
      playerId: id,
      name: pl.name,
      position: pl.position,
      nflTeam: pl.team,
      cost: ev.amount,
      worth: data.values.get(id)?.value ?? 0,
      kept: !!r,
      ownerTeam: r?.teamName ?? null,
      keeperCost: r?.keeperCost ?? null,
    });
  }
  // Inflated worth is what makes the comparison like-for-like — see the note in draftValue.ts.
  return buildDraftValueReport(buys, auctionSeason, ctx.season, leagueInflation(ctx, data).multiplier);
}

/** A player's positional finish in one season: e.g. RB3 in 2024. */
export interface SeasonFinish {
  season: string;
  position: string;
  rank: number; // 1 = best at the position that season
  points: number; // season total
}

/** A player's last-season drilldown: weekly log + consistency grade/archetype + light context. */
export interface PlayerDetail {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  season: string; // the season the weekly log is from
  weekly: WeekScore[]; // week-tagged game log — every NFL week the player actually played, not just ours
  grade: PlayerGrade;
  finishes: SeasonFinish[]; // positional finish every season in the league (newest first)
  rostered: boolean;
  teamName: string | null;
  keeperCost: number | null;
}

const FINISH_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

/**
 * Positional year-end finish for every player, every completed season in the league. Ranks by season
 * total fantasy points within position (over the pool that scored in our league's matchups). Cached
 * historical fetches, so cheap after the first snapshot.
 */
async function loadSeasonFinishes(ctx: Ctx): Promise<Map<string, SeasonFinish[]>> {
  const out = new Map<string, SeasonFinish[]>();
  for (const link of ctx.chain) {
    const totals = await seasonPoints(link.season);
    if (totals.size < 12) continue; // unplayed / current season with no games yet
    const byPos = new Map<string, { id: string; pts: number }[]>();
    for (const [id, pts] of totals) {
      const pos = ctx.resolve(id).position;
      if (!FINISH_POSITIONS.has(pos)) continue;
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos)!.push({ id, pts });
    }
    for (const [pos, arr] of byPos) {
      arr.sort((a, b) => b.pts - a.pts);
      arr.forEach((x, i) => {
        if (!out.has(x.id)) out.set(x.id, []);
        out.get(x.id)!.push({ season: link.season, position: pos, rank: i + 1, points: Math.round(x.pts * 10) / 10 });
      });
    }
  }
  for (const arr of out.values()) arr.sort((a, b) => Number(b.season) - Number(a.season));
  return out;
}

/**
 * Per-player drilldown details for every relevant player with a last-season game log (source-independent:
 * weekly points + grade + keeper cost don't depend on the value source). Baked whole so the web modal can
 * look a player up with no round-trip. Relevant = rostered OR scored ≥40 last season.
 */
export async function loadPlayerDetails(ctx: Ctx, data: KeeperData): Promise<Record<string, PlayerDetail>> {
  const [weekly, finishes] = await Promise.all([loadLastSeasonWeekly(ctx), loadSeasonFinishes(ctx)]);
  const prev = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  const season = prev?.season ?? ctx.season;

  const rostered = new Map<string, { teamName: string; keeperCost: number }>();
  for (const t of ctx.registry) {
    for (const l of teamKeeperLines(ctx, data, t)) rostered.set(l.playerId, { teamName: t.teamName, keeperCost: l.keeperCostNextYear });
  }

  const out: Record<string, PlayerDetail> = {};
  for (const [id, log] of weekly) {
    if (!log.length) continue;
    const total = log.reduce((s, x) => s + x.points, 0);
    const r = rostered.get(id);
    if (!r && total < 80) continue; // trim: rostered players + last season's real contributors (drop deep scrubs)
    const pl = ctx.resolve(id);
    out[id] = {
      playerId: id,
      name: pl.name,
      position: pl.position,
      nflTeam: pl.team,
      season,
      weekly: log,
      grade: gradePlayer(log, pl.position),
      finishes: finishes.get(id) ?? [],
      rostered: !!r,
      teamName: r?.teamName ?? null,
      keeperCost: r?.keeperCost ?? null,
    };
  }
  return out;
}

const SCARCITY_POSITIONS = ["QB", "RB", "WR", "TE"];

export interface TierBoard {
  byPosition: Record<string, Tier[]>; // QB/RB/WR/TE each tiered independently
  overall: Tier[]; // all skill players tiered by $ (cross-position — "is this TE worth a WR-tier price?")
}

/**
 * Tier board (#4): gap-cluster the value-ranked pool into draft tiers, per-position and cross-position.
 * Value-dependent (ranks come from the active source).
 */
export function loadTiers(ctx: Ctx, data: KeeperData): TierBoard {
  const byPos: Record<string, TierPlayer[]> = { QB: [], RB: [], WR: [], TE: [] };
  const all: TierPlayer[] = [];
  for (const [id, v] of data.values) {
    const pl = ctx.resolve(id);
    if (!(pl.position in byPos)) continue;
    const tp: TierPlayer = { playerId: id, name: pl.name, position: pl.position, nflTeam: pl.team, value: v.value };
    byPos[pl.position]!.push(tp);
    all.push(tp);
  }
  const byPosition: Record<string, Tier[]> = {};
  for (const pos of SCARCITY_POSITIONS) byPosition[pos] = tierize(byPos[pos] ?? [], { limit: 24 });
  return { byPosition, overall: bandize(all) }; // per-position = gap tiers; cross-position = fixed $ bands
}

/**
 * The full skill-player pool for the draft target assistant (#1): every rostered player + free agent
 * with worth, tier, current owner, and whether they're a projected keeper (likely off the auction board).
 * Value-dependent (worth/tier/keeper come from the active source). The web scores this client-side against
 * your live kept set; see `computeDraftTargets`.
 */
export function loadTargetPool(ctx: Ctx, data: KeeperData): TargetCandidate[] {
  const tiers = loadTiers(ctx, data);
  const tierOf = new Map<string, number>();
  for (const pos of Object.keys(tiers.byPosition)) for (const t of tiers.byPosition[pos]!) for (const p of t.players) tierOf.set(p.playerId, t.tier);

  const rosteredIds = new Set<string>();
  const out: TargetCandidate[] = [];
  for (const team of ctx.registry) {
    for (const l of teamSurplusBoard(ctx, data, team)) {
      rosteredIds.add(l.playerId);
      if (STREAMER_POSITIONS.has(l.position)) continue; // K/DEF are streamed, not auction targets
      out.push({
        playerId: l.playerId, name: l.name, position: l.position, nflTeam: l.nflTeam,
        worth: l.worth, tier: tierOf.get(l.playerId) ?? null, ownerTeamId: team.rosterId, projectedKeeper: l.surplus > 0,
      });
    }
  }
  for (const [id, v] of data.values) {
    if (rosteredIds.has(id) || v.value < 3) continue; // cap depth: skip $0–2 free-agent scrubs (never real targets)
    const pl = ctx.resolve(id);
    if (!SCARCITY_POSITIONS.includes(pl.position)) continue;
    out.push({ playerId: id, name: pl.name, position: pl.position, nflTeam: pl.team, worth: v.value, tier: tierOf.get(id) ?? null, ownerTeamId: null, projectedKeeper: false });
  }
  return out;
}

/** Base starter slots per skill position (QB/RB/WR/TE), from the league's roster settings. */
export function leagueStarterSlots(ctx: Ctx): Record<string, number> {
  return startingSlots(ctx.rosterPositions);
}

/**
 * Positional scarcity (#3): per-position, how much of the top tier is kept (off the board) vs available.
 * Value-dependent (ranks come from the active source). "kept" = a **rational keeper** (rostered AND
 * worth ≥ keeper cost, i.e. positive surplus) — same assumption the inflation model uses. This is a
 * better proxy than raw "rostered" before managers lock keepers: overpriced roster players are treated
 * as likely cuts (available), so the map differentiates positions instead of reading 100% everywhere.
 */
export function loadScarcity(ctx: Ctx, data: KeeperData, topN = 12): PositionScarcity[] {
  const keptIds = new Set<string>();
  for (const t of ctx.registry) for (const l of teamSurplusBoard(ctx, data, t)) if (l.surplus > 0) keptIds.add(l.playerId);

  const players: ScarcityPlayer[] = [];
  for (const [id, v] of data.values) {
    const pl = ctx.resolve(id);
    if (!SCARCITY_POSITIONS.includes(pl.position)) continue;
    players.push({ playerId: id, name: pl.name, position: pl.position, nflTeam: pl.team, value: v.value, kept: keptIds.has(id) });
  }
  return computeScarcity(players, SCARCITY_POSITIONS, topN);
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

const BRAIN_POSITIONS = ["QB", "RB", "WR", "TE"];
const RB_AGE_CLIFF = 5; // years_exp at/over which an RB is "cliff risk" (roughly age 27+)
const MIN_GRADE_GAMES = 8; // weeks of log needed before a player's boom/bust profile is trustworthy
const VOLATILE_ARCHETYPES = new Set(["boom-bust", "one-week-wonder"]);

/**
 * League Brain (v3): per-team profile (contender index + archetype + tendency tags + scouting line) and
 * league-wide superlatives. Value-dependent (roster value / keeper surplus / contender index come from the
 * active source), so it's baked per source like tiers/scarcity. Assembles digested numbers per team and
 * hands them to the pure `computeLeagueBrain`. See specs/league-brain.md.
 */
export async function loadLeagueBrain(ctx: Ctx, data: KeeperData): Promise<LeagueBrain> {
  const players = (await sleeper.getPlayers()) ?? {};
  const [spend, tradeCounts, board, lastWins, vorp, weekly, lastBuys] = await Promise.all([
    buildDraftSpendByOwner(ctx),
    buildTradeCounts(ctx),
    loadRookieBoard(ctx),
    lastSeasonWins(ctx),
    loadValues(ctx, "vorp", data.points), // "deserved" worth from actual production (for the regret index)
    loadLastSeasonWeekly(ctx), // per-player game logs (for roster volatility)
    buildLastSeasonBuys(ctx), // last season's auction buys, keyed by buyer (for the regret index)
  ]);
  const rookieByRoster = new Map(board.byTeam.map((b) => [b.rosterId, b.picks.length] as const));

  const inputs: TeamBrainInput[] = ctx.registry.map((t) => {
    let rosterValue = 0;
    let keeperSurplus = 0;
    const posCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    let ageSum = 0;
    let ageN = 0;
    let volatileN = 0;
    let gradedN = 0;
    let agingRbCount = 0;
    for (const l of teamSurplusBoard(ctx, data, t)) {
      if (STREAMER_POSITIONS.has(l.position)) continue; // K/DEF are streamed, not roster identity
      if (l.position in posCounts) posCounts[l.position]! += 1;
      rosterValue += l.worth;
      if (l.surplus > 0) keeperSurplus += l.surplus;
      const exp = players[l.playerId]?.years_exp;
      if (typeof exp === "number") {
        ageSum += exp;
        ageN += 1;
        if (l.position === "RB" && exp >= RB_AGE_CLIFF) agingRbCount += 1;
      }
      const log = weekly.get(l.playerId);
      if (log && log.length >= MIN_GRADE_GAMES) {
        gradedN += 1;
        if (VOLATILE_ARCHETYPES.has(gradePlayer(log, l.position).archetype)) volatileN += 1;
      }
    }

    // Regret: last season's auction buys, paid vs "deserved" (VORP) worth from actual production.
    let regret = 0;
    let biggestBust: { name: string; paid: number; worth: number } | null = null;
    for (const buy of (t.ownerUserId && lastBuys.get(t.ownerUserId)) || []) {
      const worth = vorp.get(buy.playerId)?.value ?? 0;
      const overpay = buy.cost - worth;
      if (overpay <= 0) continue;
      regret += overpay;
      if (!biggestBust || overpay > biggestBust.paid - biggestBust.worth) {
        biggestBust = { name: ctx.resolve(buy.playerId).name, paid: buy.cost, worth: Math.round(worth) };
      }
    }

    return {
      rosterId: t.rosterId,
      teamName: t.teamName,
      manager: t.displayName,
      lastSeasonWins: lastWins.get(t.rosterId) ?? 0,
      rosterValue: Math.round(rosterValue),
      keeperSurplus: Math.round(keeperSurplus),
      posCounts,
      spendByPos: (t.ownerUserId && spend.byOwner.get(t.ownerUserId)) || {},
      tradeCount: tradeCounts.get(t.rosterId) ?? 0,
      rookiePicks: rookieByRoster.get(t.rosterId) ?? 0,
      avgYearsExp: ageN ? Math.round((ageSum / ageN) * 10) / 10 : null,
      volatility: gradedN ? Math.round((volatileN / gradedN) * 100) / 100 : null,
      agingRbCount,
      regret: Math.round(regret),
      biggestBust,
    };
  });
  return computeLeagueBrain(inputs, { spendSeasons: spend.seasons });
}

/** Auction dollars each OWNER (user_id, stable across seasons) has spent by position, pooled over the chain. */
async function buildDraftSpendByOwner(ctx: Ctx): Promise<{ byOwner: Map<string, Record<string, number>>; seasons: number }> {
  const byOwner = new Map<string, Record<string, number>>();
  let seasons = 0;
  for (const link of ctx.chain) {
    const drafts = (await sleeper.getDrafts(link.leagueId)) ?? [];
    let sawAuction = false;
    for (const d of drafts) {
      const picks = (await sleeper.getDraftPicks(d.draft_id)) ?? [];
      for (const p of picks) {
        if (p.is_keeper === true) continue; // a carried keeper's salary isn't a draft-day spending decision
        const raw = p.metadata?.amount;
        if (raw === undefined || raw === "") continue; // no amount = not an auction pick
        const amt = Number(raw);
        if (!Number.isFinite(amt) || amt <= 0 || !p.picked_by || !p.player_id) continue;
        const pos = ctx.resolve(p.player_id).position;
        if (!BRAIN_POSITIONS.includes(pos)) continue;
        sawAuction = true;
        const rec = byOwner.get(p.picked_by) ?? {};
        rec[pos] = (rec[pos] ?? 0) + amt;
        byOwner.set(p.picked_by, rec);
      }
    }
    if (sawAuction) seasons += 1;
  }
  return { byOwner, seasons };
}

/** Last completed season's auction buys (non-keeper), keyed by the buyer's user_id — for the regret index. */
async function buildLastSeasonBuys(ctx: Ctx): Promise<Map<string, { playerId: string; cost: number }[]>> {
  const out = new Map<string, { playerId: string; cost: number }[]>();
  const prev = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  if (!prev) return out;
  const drafts = (await sleeper.getDrafts(prev.leagueId)) ?? [];
  for (const d of drafts) {
    const picks = (await sleeper.getDraftPicks(d.draft_id)) ?? [];
    for (const p of picks) {
      if (p.is_keeper === true) continue;
      const raw = p.metadata?.amount;
      if (raw === undefined || raw === "") continue;
      const amt = Number(raw);
      if (!Number.isFinite(amt) || amt <= 0 || !p.picked_by || !p.player_id) continue;
      const arr = out.get(p.picked_by) ?? [];
      arr.push({ playerId: p.player_id, cost: amt });
      out.set(p.picked_by, arr);
    }
  }
  return out;
}

/** Completed trades each roster has been party to, across the league's history (roster_id is stable here). */
async function buildTradeCounts(ctx: Ctx): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (const [i, link] of ctx.chain.entries()) {
    const historical = i > 0; // prior seasons are immutable → cached forever
    for (let week = 0; week <= 18; week++) {
      const txns = (await sleeper.getTransactions(link.leagueId, week, historical)) ?? [];
      for (const t of txns) {
        if (t.type !== "trade" || t.status !== "complete") continue;
        for (const rid of t.roster_ids ?? []) counts.set(rid, (counts.get(rid) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Last completed season's win totals per roster (records this offseason's teams as 0-0). */
async function lastSeasonWins(ctx: Ctx): Promise<Map<number, number>> {
  const prev = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  const rosters = (await sleeper.getRosters(prev?.leagueId ?? ctx.leagueId)) ?? [];
  const out = new Map<number, number>();
  for (const r of rosters) out.set(r.roster_id, r.settings?.wins ?? 0);
  return out;
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
