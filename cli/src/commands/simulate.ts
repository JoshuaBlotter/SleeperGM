import { getLeagueId, summarizeCap } from "@sgm/core";
import { heading, money, signedMoney } from "../format";
import { loadContext, loadKeeperData, pickTeam, teamSurplusBoard } from "@sgm/core";

export async function simulate(opts: { team?: string; keep?: string }): Promise<void> {
  if (!opts.team) throw new Error("simulate requires --team <name|#>");
  const ctx = await loadContext(getLeagueId());
  const t = pickTeam(ctx, opts.team);
  const data = await loadKeeperData(ctx);
  const board = teamSurplusBoard(ctx, data, t);

  const wanted = (opts.keep ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const kept = board.filter((l) =>
    wanted.some((w) => l.name.toLowerCase().includes(w) || l.playerId === w),
  );
  if (wanted.length && kept.length === 0) {
    console.log(`No players on ${t.teamName} matched: ${wanted.join(", ")}`);
    return;
  }

  const cap = summarizeCap(kept.map((l) => l.keeperCostNextYear));
  const totalSurplus = kept.reduce((a, l) => a + l.surplus, 0);

  console.log(heading(`Simulate keepers — ${t.teamName} (#${t.rosterId})`));
  for (const l of kept) {
    console.log(` • ${l.name} (${l.position}) — keep ${money(l.keeperCostNextYear)}, surplus ${signedMoney(l.surplus)}`);
  }
  console.log(
    `\nKeeping ${cap.count}: ${money(cap.capUsed)} of $${cap.capBudget} used, ${money(cap.capAvailable)} left for auction.`,
  );
  console.log(`Total keeper surplus: ${signedMoney(totalSurplus)}`);
  if (cap.capAvailable < 0) console.log(`⚠  Over the cap by ${money(-cap.capAvailable)}!`);
}
