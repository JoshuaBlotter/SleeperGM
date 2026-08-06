// Live smoke test against the real Sleeper API. NOT a unit test — run manually: `npm run smoke`.
// Prints key facts so we notice if the upstream API shape drifts.

import {
  buildChain,
  buildDraftIndex,
  getLeagueId,
  loadRegistry,
  sleeper,
} from "@sgm/core";

async function main() {
  const leagueId = getLeagueId();
  console.log(`Smoke test against league ${leagueId}\n`);

  const league = await sleeper.getLeague(leagueId);
  if (!league) throw new Error("League not found — is LEAGUE_ID correct?");
  console.log(`✓ League: "${league.name}" (${league.season}, status=${league.status})`);
  console.log(`  roster: ${league.roster_positions.join(", ")}`);

  const registry = await loadRegistry(leagueId);
  console.log(`✓ Teams: ${registry.length}`);
  for (const t of registry.slice(0, 3)) console.log(`    #${t.rosterId} ${t.teamName} (${t.displayName})`);
  console.log(`    ...`);

  const chain = await buildChain(leagueId);
  console.log(`✓ History chain: ${chain.map((c) => c.season).join(" -> ")}`);

  const drafts = await buildDraftIndex(chain);
  const prev = chain.find((c) => c.leagueId !== leagueId) ?? chain[0];
  const season = prev?.season ?? league.season;
  const seasonEvents = drafts.get(season);
  if (seasonEvents && seasonEvents.size) {
    const auctions = [...seasonEvents.entries()].flatMap(([pid, e]) => (e.source === "auction" ? [[pid, e.amount] as const] : []));
    const rookies = [...seasonEvents.values()].filter((e) => e.source === "rookie").length;
    const top = auctions.sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(`✓ ${season} draft events: ${auctions.length} auction + ${rookies} rookie. Top auction:`);
    for (const [pid, amt] of top) console.log(`    ${pid}: $${amt}`);
  } else {
    console.log(`! No draft events found for ${season}.`);
  }

  console.log(`\nSmoke test OK.`);
}

main().catch((err) => {
  console.error(`\nSmoke test FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
