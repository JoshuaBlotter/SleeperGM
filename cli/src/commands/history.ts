import { getLeagueId, loadContext, loadKeeperData, loadSeasonRecap, type RecapRow } from "@sgm/core";
import { heading, money, signedMoney, table } from "../format";

/** How last season's salary was set, in one column. */
function basis(r: RecapRow): string {
  const label = r.basis === "rookie" ? (r.note ?? "rookie") : r.basis === "free_agent" ? "waiver claim" : r.basis;
  return r.approximate ? `${label} ≈` : label;
}

export async function history(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const r = await loadSeasonRecap(ctx, data);
  const t = r.totals;

  console.log(heading(`${r.season} draft recap and the ${r.nextSeason} salary ledger`));
  console.log(
    ` ${t.auctionPicks} auction buys for ${money(t.auctionSpend)}, ${t.rookiePicks} rookie picks. ` +
      `${r.ledger.length} players still rostered: ${money(t.ledgerLast)} in ${r.season} → ${money(t.ledgerThis)} in ` +
      `${r.nextSeason} (${signedMoney(t.ledgerDelta)} of escalation).`,
  );
  console.log(` ≈ marks a ${r.season} figure we replayed that the salary sheet disagrees with.`);

  console.log(`\n${r.season} rookie draft`);
  console.log(
    table(r.rookie, [
      { header: "Pick", get: (p) => p.note ?? String(p.pickNo ?? "") },
      { header: "Player", get: (p) => p.name },
      { header: "Pos", get: (p) => p.position },
      { header: "By", get: (p) => p.byTeam ?? "—" },
      { header: `${r.season} $`, get: (p) => money(p.lastSalary ?? 0), align: "right" },
      { header: `${r.nextSeason} $`, get: (p) => (p.thisSalary == null ? "dropped" : money(p.thisSalary)), align: "right" },
      { header: "Δ", get: (p) => (p.delta == null ? "—" : signedMoney(p.delta)), align: "right" },
    ]),
  );

  console.log(`\n${r.season} auction — top 25 buys of ${r.auction.length}`);
  console.log(
    table(r.auction.slice(0, 25), [
      { header: "Player", get: (p) => p.name },
      { header: "Pos", get: (p) => p.position },
      { header: "By", get: (p) => p.byTeam ?? "—" },
      { header: `${r.season} $`, get: (p) => money(p.lastSalary ?? 0), align: "right" },
      { header: `${r.nextSeason} $`, get: (p) => (p.thisSalary == null ? "dropped" : money(p.thisSalary)), align: "right" },
      { header: "Δ", get: (p) => (p.delta == null ? "—" : signedMoney(p.delta)), align: "right" },
      { header: "Now", get: (p) => p.ownerTeam ?? "pool" },
    ]),
  );

  console.log(`\n${r.nextSeason} salary ledger — top 30 of ${r.ledger.length}`);
  console.log(
    table(r.ledger.slice(0, 30), [
      { header: "Player", get: (p) => p.name },
      { header: "Pos", get: (p) => p.position },
      { header: "Team", get: (p) => p.ownerTeam ?? "—" },
      { header: `${r.season} via`, get: basis },
      { header: `${r.season} $`, get: (p) => (p.lastSalary == null ? "—" : money(p.lastSalary)), align: "right" },
      { header: "Δ", get: (p) => (p.delta == null ? "—" : signedMoney(p.delta)), align: "right" },
      { header: `${r.nextSeason} $`, get: (p) => money(p.thisSalary ?? 0), align: "right" },
    ]),
  );
}
