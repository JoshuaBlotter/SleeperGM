import { getLeagueId, loadContext, loadKeeperData, loadScarcity, worthSource } from "@sgm/core";
import { heading, money } from "../format";

export async function scarcity(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const positions = loadScarcity(ctx, data);

  console.log(heading(`Positional scarcity — top-12 kept vs available (${worthSource()})`));
  console.log(` "kept" = projected keeper (worth >= keeper cost). Higher % = scarcer; expect a price run.`);
  for (const p of positions) {
    const pct = Math.round(p.scarcityScore * 100);
    const bar = "█".repeat(Math.round(pct / 5)).padEnd(20);
    console.log(
      `\n ${p.position.padEnd(3)} ${bar} ${String(pct).padStart(3)}% scarce  ` +
        `(${p.keptCount}/${p.topN} kept, ${p.availableCount} open)`,
    );
    console.log(`     best available: ${p.bestAvailable ? `${p.bestAvailable.name} (${money(p.bestAvailable.value)})` : "—"}`);
  }
}
