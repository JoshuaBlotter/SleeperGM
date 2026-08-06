import { getLeagueId } from "@sgm/core";
import { heading, money, signedMoney, table } from "../format";
import { inflateBoard, leagueInflation, loadContext, loadKeeperData, pickTeam, teamSurplusBoard } from "@sgm/core";

export async function keepers(query?: string, opts?: { inflated?: boolean }): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const teams = query ? [pickTeam(ctx, query)] : ctx.registry;
  const data = await loadKeeperData(ctx);

  const inflated = opts?.inflated ?? false;
  const mult = inflated ? leagueInflation(ctx, data).multiplier : 1;

  for (const t of teams) {
    let board = teamSurplusBoard(ctx, data, t);
    if (inflated) board = inflateBoard(board, mult);

    console.log(heading(`Keeper board — ${t.teamName} (#${t.rosterId})${inflated ? `  [inflation ×${mult.toFixed(2)}]` : ""}`));
    console.log(
      table(board, [
        { header: "Player", get: (l) => l.name },
        { header: "Pos", get: (l) => l.position },
        { header: inflated ? "Worth*" : "Worth", get: (l) => money(l.worth), align: "right" },
        { header: "Keep$", get: (l) => money(l.keeperCostNextYear), align: "right" },
        { header: "Surplus", get: (l) => signedMoney(l.surplus), align: "right" },
        { header: "Call", get: (l) => l.recommendation },
      ]),
    );
  }
  if (inflated) {
    console.log(`\n* Worth is inflation-adjusted (skill × ${mult.toFixed(2)}; K/DEF unchanged) — the real auction price given league keeper surplus.`);
  } else {
    console.log(`\nKeep$ uses the real league rules; Worth/surplus use a v1 valuation. Add --inflated for market-adjusted worth.`);
  }
}
