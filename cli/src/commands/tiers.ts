import { getLeagueId, loadContext, loadKeeperData, loadTiers, worthSource } from "@sgm/core";
import { heading } from "../format";

export async function tiers(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const board = loadTiers(ctx, data);

  console.log(heading(`Value tiers by position (${worthSource()})`));
  console.log(` A new tier = a real value cliff. Draft by tier, not rank.`);
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    console.log(`\n ${pos}`);
    for (const t of board.byPosition[pos] ?? []) {
      console.log(`   ${t.label.padEnd(7)} ${t.players.map((p) => `${p.name} $${p.value}`).join(", ")}`);
    }
  }
}
