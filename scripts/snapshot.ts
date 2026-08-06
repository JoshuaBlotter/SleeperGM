// Generate a static data snapshot for the GitHub Pages build: runs the SAME engines the server uses
// and writes one web/public/data.json the static site reads. Re-run when rosters/salaries change.
// Usage: npm run snapshot

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  computeTrades,
  getLeagueId,
  inflateBoard,
  leagueInflation,
  leagueRules,
  loadContext,
  loadKeeperData,
  outstandingRules,
  STREAMER_POSITIONS,
  teamSurplusBoard,
  type TradePlayer,
} from "@sgm/core";

async function main() {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const infl = leagueInflation(ctx, data);
  const cap = leagueRules.capBudget;

  const league = {
    season: ctx.season,
    capBudget: cap,
    multiplier: infl.multiplier,
    teams: ctx.registry.map((t) => ({
      rosterId: t.rosterId,
      teamName: t.teamName,
      manager: t.displayName,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      players: t.players.length,
      taxi: t.taxi.length,
    })),
  };

  const teams: Record<number, unknown> = {};
  const trades: Record<number, unknown> = {};
  const allPlayers: TradePlayer[] = [];
  const playerRows: unknown[] = [];

  for (const t of ctx.registry) {
    const base = teamSurplusBoard(ctx, data, t);
    const inflated = inflateBoard(base, infl.multiplier);
    const teamResp = (lines: typeof base, isInflated: boolean, mult: number) => {
      const used = lines.reduce((s, l) => s + l.keeperCostNextYear, 0);
      return {
        rosterId: t.rosterId,
        teamName: t.teamName,
        manager: t.displayName,
        record: { wins: t.wins, losses: t.losses, ties: t.ties },
        inflated: isInflated,
        multiplier: mult,
        cap: { budget: cap, used, available: cap - used },
        lines,
      };
    };
    teams[t.rosterId] = { base: teamResp(base, false, 1), inflated: teamResp(inflated, true, infl.multiplier) };

    for (const l of base) {
      playerRows.push({ teamId: t.rosterId, teamName: t.teamName, ...l });
      if (!STREAMER_POSITIONS.has(l.position))
        allPlayers.push({ playerId: l.playerId, name: l.name, position: l.position, teamId: t.rosterId, teamName: t.teamName, worth: l.worth, salary: l.keeperCostNextYear, surplus: l.surplus });
    }
  }

  for (const t of ctx.registry) {
    trades[t.rosterId] = computeTrades(allPlayers, t.rosterId, { rosterPositions: ctx.rosterPositions });
  }

  const bundle = {
    generatedFor: ctx.season,
    league,
    teams,
    inflation: infl,
    players: { players: playerRows },
    rules: { rules: leagueRules, outstanding: outstandingRules() },
    trades,
  };

  const outDir = path.join(process.cwd(), "web", "public");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "data.json");
  writeFileSync(out, JSON.stringify(bundle));
  console.log(`Wrote ${out} (${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB) — season ${ctx.season}, ${ctx.registry.length} teams.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
