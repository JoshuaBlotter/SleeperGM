import { getLeagueId, loadContext, loadDraftValue, loadKeeperData, worthSource } from "@sgm/core";
import { heading, money, signedMoney, table } from "../format";

export async function draftValue(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const r = loadDraftValue(ctx, data);
  const net = r.totalWorth - r.totalCost;

  console.log(heading(`Historical draft value — ${r.auctionSeason} auction vs ${r.projectionSeason} worth (${worthSource()})`));
  console.log(` Last year's auction buys only (carried keepers + rookie picks excluded).`);
  console.log(
    ` ${r.auctionSeason} spend ${money(r.totalCost)} → ${r.projectionSeason} projected ${money(r.totalWorth)} ` +
      `(${signedMoney(net)} ${net >= 0 ? "higher" : "lower"}), ${r.rows.length} players.`,
  );

  console.log(
    "\n" +
      table(r.rows, [
        { header: "Player", get: (p) => p.name },
        { header: "Pos", get: (p) => p.position },
        { header: `${r.auctionSeason} $`, get: (p) => money(p.cost), align: "right" },
        { header: `${r.projectionSeason} worth`, get: (p) => money(p.worth), align: "right" },
        { header: "Δ", get: (p) => `${signedMoney(p.delta)}${p.deltaPct == null ? "" : ` (${p.deltaPct > 0 ? "+" : ""}${p.deltaPct}%)`}`, align: "right" },
        { header: "Now", get: (p) => (p.kept ? `kept ${money(p.keeperCost ?? 0)} (${p.ownerTeam})` : "pool") },
      ]),
  );
}
