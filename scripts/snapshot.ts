// Generate a static data snapshot for the GitHub Pages build: runs the SAME engines the server uses
// and writes one web/public/data.json the static site reads. Re-run when rosters/salaries change.
// Usage: npm run snapshot
//
// Value-dependent view models (teams, inflation, trades) are baked PER value source so the static site
// can switch sources client-side (no server). Source-independent facts (team list, raw player rows)
// are baked once.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  computeTrades,
  getLeagueId,
  inflateBoard,
  leagueInflation,
  leagueRules,
  loadAllPlayers,
  leagueStarterSlots,
  loadContext,
  loadDraftValue,
  loadKeeperData,
  loadLeagueBrain,
  loadPlayerDetails,
  loadRookieBoard,
  loadScarcity,
  loadTargetPool,
  loadTiers,
  loadTrending,
  outstandingRules,
  STREAMER_POSITIONS,
  teamSurplusBoard,
  withValueSource,
  worthSource,
  worthSources,
  type KeeperData,
  type Ctx,
  type TradePlayer,
} from "@sgm/core";

/** Build every value-dependent view model (teams, inflation, trades) for one value source. */
async function buildForSource(ctx: Ctx, data: KeeperData, source: string) {
  const infl = leagueInflation(ctx, data);
  const cap = leagueRules.capBudget;
  const teams: Record<number, unknown> = {};
  const allPlayers: TradePlayer[] = [];

  for (const t of ctx.registry) {
    const base = teamSurplusBoard(ctx, data, t);
    const inflated = inflateBoard(base, infl.multiplier);
    const teamResp = (lines: typeof base, isInflated: boolean, mult: number) => {
      const used = lines.reduce((s, l) => s + l.keeperCostNextYear, 0);
      return {
        rosterId: t.rosterId,
        teamName: t.teamName,
        manager: t.displayName,
        avatar: t.avatar,
        record: { wins: t.wins, losses: t.losses, ties: t.ties },
        inflated: isInflated,
        multiplier: mult,
        cap: { budget: cap, used, available: cap - used },
        lines,
      };
    };
    teams[t.rosterId] = { base: teamResp(base, false, 1), inflated: teamResp(inflated, true, infl.multiplier) };

    for (const l of base) {
      if (!STREAMER_POSITIONS.has(l.position))
        allPlayers.push({ playerId: l.playerId, name: l.name, position: l.position, teamId: t.rosterId, teamName: t.teamName, worth: l.worth, salary: l.keeperCostNextYear, surplus: l.surplus });
    }
  }

  const trades: Record<number, unknown> = {};
  for (const t of ctx.registry) trades[t.rosterId] = computeTrades(allPlayers, t.rosterId, { rosterPositions: ctx.rosterPositions });

  return { multiplier: infl.multiplier, valueSource: source, inflation: infl, teams, trades, draftValue: loadDraftValue(ctx, data), scarcity: loadScarcity(ctx, data), tiers: loadTiers(ctx, data), targetPool: loadTargetPool(ctx, data), brain: await loadLeagueBrain(ctx, data) };
}

async function main() {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const cap = leagueRules.capBudget;
  const sources = worthSources();
  const defaultSource = worthSource();

  // Source-independent: all fantasy-relevant players (rostered + free agents) and trending adds.
  const [playerRows, trending] = await Promise.all([loadAllPlayers(ctx, data), loadTrending(ctx, data)]);

  const league = {
    season: ctx.season,
    capBudget: cap,
    sources,
    defaultSource,
    starterSlots: leagueStarterSlots(ctx),
    teams: ctx.registry.map((t) => ({
      rosterId: t.rosterId,
      teamName: t.teamName,
      manager: t.displayName,
      avatar: t.avatar,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      players: t.players.length,
      taxi: t.taxi.length,
    })),
  };

  // Bake each value source. The default source is already loaded; others swap in via withValueSource.
  const bySource: Record<string, unknown> = {};
  for (const src of sources) {
    const d = src === defaultSource ? data : await withValueSource(ctx, data, src);
    bySource[src] = await buildForSource(ctx, d, src);
  }

  const [rookies, playerDetails] = await Promise.all([loadRookieBoard(ctx), loadPlayerDetails(ctx, data)]);

  const bundle = {
    generatedFor: ctx.season,
    generatedAt: new Date().toISOString(),
    league,
    bySource,
    players: { players: playerRows, trending },
    playerDetails,
    rules: { rules: leagueRules, outstanding: outstandingRules() },
    rookies,
  };

  const outDir = path.join(process.cwd(), "web", "public");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "data.json");
  writeFileSync(out, JSON.stringify(bundle));
  console.log(
    `Wrote ${out} (${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB) — season ${ctx.season}, ` +
      `${ctx.registry.length} teams, sources: ${sources.join(", ")} (default ${defaultSource}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
