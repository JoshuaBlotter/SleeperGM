// Fetch ESPN's published auction values and convert them to config/values/espn.csv (a static,
// committed value source). Re-run to refresh. Usage: npm run values:espn [year]
//
// ESPN's read endpoint is public and unauthenticated, but it only returns a handful of players unless
// you ask for more via the x-fantasy-filter header. `leaguedefaults/3` is ESPN's stock PPR league; the
// values come back on its scale and `espnToValueRows` rescales them to ours.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { espnToValueRows, leagueRules, type EspnPlayerNode } from "@sgm/core";

const LIMIT = 400; // ESPN prices ~160 players; 400 covers the board with room to spare.

async function main() {
  const year = Number(process.argv[2] ?? new Date().getFullYear());
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/3?view=kona_player_info`;
  const filter = { players: { limit: LIMIT, sortPercOwned: { sortAsc: false, sortPriority: 1 } } };
  const res = await fetch(url, { headers: { "x-fantasy-filter": JSON.stringify(filter) } });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  const json = (await res.json()) as { players?: EspnPlayerNode[] };

  const rows = espnToValueRows(json.players ?? [], { numTeams: 12, budget: leagueRules.capBudget });
  if (!rows.length) throw new Error(`No priced ESPN players for ${year} — try a different year.`);

  const header = "name,position,team,value";
  const lines = rows.map((r) => `${csv(r.name)},${r.position ?? ""},${r.team ?? ""},${r.value}`);
  const outDir = path.join(process.cwd(), "config", "values");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "espn.csv");
  writeFileSync(
    out,
    [`# ESPN auction values (PPR, ${year}), rescaled from ESPN's 10-team pool to 12 x $${leagueRules.capBudget}`, header, ...lines].join("\n") + "\n",
  );
  const top = rows.slice(0, 5).map((r) => `${r.name} $${r.value}`).join(", ");
  console.log(`Wrote ${out} (${rows.length} players, ${year}). Top: ${top}`);
}

function csv(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
