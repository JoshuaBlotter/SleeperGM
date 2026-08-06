// Orchestration: compose the pure engines with live (cached) data into view models.
// Network-touching glue lives here (not in the pure engines) and is shared by the CLI and the server.

import { accumulatedSalary, baseSalary, yearIncrement } from "./engines/keepers";
import { buildAcquisitionIndex, ownerTenureStart } from "./history/tenure";
import { buildChain } from "./history/chain";
import { buildDraftIndex } from "./history/prices";
import { buildFaabIndex } from "./history/waivers";
import { buildProvenance } from "./history/provenance";
import { computeInflation, type InflationPlayer, type InflationResult } from "./engines/inflation";
import { findTeam, loadRegistry } from "./registry/teams";
import { recommendation, toSurplusLines } from "./engines/surplus";
import { loadSalarySheet, sheetSalary, sheetSupersededByReacquire } from "./config/salaries";
import { leagueRules } from "./config/league-rules";
import { loadResolver } from "./sleeper/players";
import { seasonPoints } from "./engines/points";
import { sleeper } from "./sleeper/client";
import { valuePlayers } from "./engines/valuation";
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
  sheet: ReturnType<typeof loadSalarySheet>;
}

export async function loadKeeperData(ctx: Ctx): Promise<KeeperData> {
  const [drafts, faab, acq, values] = await Promise.all([
    buildDraftIndex(ctx.chain),
    buildFaabIndex(ctx.chain),
    buildAcquisitionIndex(ctx.chain),
    loadValues(ctx),
  ]);
  return { drafts, faab, acq, values, sheet: loadSalarySheet() };
}

/** Per-player keeper cost lines for a team (provenance + owner tenure + salary replay/override). */
export function teamKeeperLines(ctx: Ctx, data: KeeperData, team: Team): KeeperLine[] {
  const { drafts, faab, acq, sheet } = data;
  const prov = buildProvenance(team.players, ctx.chain, drafts, faab, ctx.season);
  const currentYear = Number(ctx.season);
  const oldestSeason = Number(ctx.chain[ctx.chain.length - 1]?.season);

  return prov.map((p): KeeperLine => {
    const pl = ctx.resolve(p.playerId);

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
      return line(p, pl, { base: entry.salary, cost, yearsKept: yk, isPlaceholder: false, source: "sheet", approximate: false });
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
    return line(p, pl, { base: acquiredSalary, cost, yearsKept, isPlaceholder, source: "computed", approximate: p.costKnown && (traded || preSleeperRisk) });
  });
}

function line(
  p: Provenance,
  pl: PlayerLite,
  x: { base: number; cost: number; yearsKept: number; isPlaceholder: boolean; source: "sheet" | "computed"; approximate: boolean },
): KeeperLine {
  return {
    ...p,
    yearsKept: x.yearsKept,
    name: pl.name,
    position: pl.position,
    baseCost: x.base,
    keeperCostNextYear: x.cost,
    keeperCostIsPlaceholder: x.isPlaceholder,
    salarySource: x.source,
    approximate: x.approximate,
  };
}

/** Valuation for all players, using the previous season's realized points as the projection. */
export async function loadValues(ctx: Ctx): Promise<Map<string, ValueLine>> {
  const league = await sleeper.getLeague(ctx.leagueId);
  const prevSeason = ctx.chain.find((c) => c.leagueId !== ctx.leagueId) ?? ctx.chain[0];
  const isHistorical = prevSeason?.leagueId !== ctx.leagueId;
  const points = await seasonPoints(prevSeason?.leagueId ?? ctx.leagueId, 17, isHistorical);
  const meta = new Map<string, PlayerLite>();
  for (const id of points.keys()) meta.set(id, ctx.resolve(id));
  return valuePlayers({
    pointsByPlayer: points,
    meta,
    rosterPositions: league?.roster_positions ?? [],
    numTeams: league?.total_rosters ?? ctx.registry.length,
    budget: leagueRules.capBudget,
  });
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
