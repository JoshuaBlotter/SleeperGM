// Snapshot a few live Sleeper responses to disk for integration/debugging.
// These are NOT the unit-test fixtures (those are hand-made in core/src/__tests__/fixtures.ts).
// Usage: npm run fixtures

import { promises as fs } from "node:fs";
import path from "node:path";
import { buildChain, getLeagueId, sleeper } from "@sgm/core";

const OUT = path.join(process.cwd(), "scripts", "snapshots");

async function save(name: string, data: unknown) {
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
  console.log(`  wrote ${name}.json`);
}

async function main() {
  const leagueId = getLeagueId();
  console.log(`Snapshotting live data for league ${leagueId} -> scripts/snapshots/`);
  await save("league", await sleeper.getLeague(leagueId));
  await save("rosters", await sleeper.getRosters(leagueId));
  await save("users", await sleeper.getUsers(leagueId));
  const chain = await buildChain(leagueId);
  await save("chain", chain);
  const prev = chain.find((c) => c.leagueId !== leagueId) ?? chain[0];
  if (prev?.draftId) await save("prev_draft_picks", await sleeper.getDraftPicks(prev.draftId));
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
