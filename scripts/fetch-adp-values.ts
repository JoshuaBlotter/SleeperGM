// Fetch current ADP from Fantasy Football Calculator's public API and convert it to auction values,
// written to config/values/adp.csv (a static, committed value source). Re-run to refresh.
// Usage: npm run values:adp

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { adpToAuctionValues, leagueRules, type AdpPlayer } from "@sgm/core";

interface FfcPlayer {
  name: string;
  position: string;
  team: string;
  adp: number;
}

async function main() {
  const year = Number(process.argv[2] ?? new Date().getFullYear());
  const url = `https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=12&year=${year}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FFC ADP ${res.status} for ${url}`);
  const json = (await res.json()) as { players?: FfcPlayer[]; meta?: { total_drafts?: number } };
  const players: AdpPlayer[] = (json.players ?? [])
    .filter((p) => p.name && p.adp)
    .map((p) => ({ name: p.name, position: p.position, team: p.team, adp: p.adp }));
  if (!players.length) throw new Error(`No ADP players for ${year} — try a different year.`);

  const values = adpToAuctionValues(players, { numTeams: 12, budget: leagueRules.capBudget });
  const header = "name,position,team,value";
  const lines = values.map((v) => `${csv(v.name)},${v.position ?? ""},${v.team ?? ""},${v.value}`);

  const outDir = path.join(process.cwd(), "config", "values");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "adp.csv");
  writeFileSync(out, [`# ADP-derived auction values (FFC PPR 12-team, ${year}, ${json.meta?.total_drafts ?? "?"} drafts)`, header, ...lines].join("\n") + "\n");
  const top = values.slice(0, 5).map((v) => `${v.name} $${v.value}`).join(", ");
  console.log(`Wrote ${out} (${values.length} players, ${year}). Top: ${top}`);
}

function csv(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
