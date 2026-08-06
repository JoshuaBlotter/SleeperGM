import { getLeagueId, leagueRules } from "@sgm/core";
import { heading, money, signedMoney, table } from "../format";
import { leagueInflation, loadContext, loadKeeperData } from "@sgm/core";

export async function inflation(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const r = leagueInflation(ctx, data);
  const pct = Math.round((r.multiplier - 1) * 100);

  console.log(heading(`League auction inflation — ${ctx.season}`));
  console.log(` (kickers & defenses excluded — streamed for ~$0, not kept for value)`);
  console.log(` League cap:            ${money(r.capTotal)}  (${r.numTeams} × $${leagueRules.capBudget})`);
  console.log(` Rational keepers:      ${r.keptCount} players (worth > salary); ${r.releasedCount} released to auction`);
  console.log(`   spent on keepers:    ${money(r.keeperSalaries)}`);
  console.log(`   market worth kept:   ${money(r.keeperWorth)}`);
  console.log(`   => keeper surplus:   ${money(r.keeperSurplus)}   ← extra $ pushed into the draft economy`);
  console.log(``);
  console.log(` Auction economy:`);
  console.log(`   money for auction:   ${money(r.auctionMoney)}   (cap − keeper salaries)`);
  console.log(`   value for auction:   ${money(r.auctionValue)}   (cap − keeper worth)`);
  console.log(`   => INFLATION:        ×${r.multiplier.toFixed(2)}  (~${pct}% over face) — available players cost ~${r.multiplier.toFixed(2)}× base value`);
  console.log(`   (valuation calibration vs cap: ${r.calibration} — near 1.0 means worth ≈ money scale)`);

  console.log(heading("Biggest discounts driving inflation"));
  console.log(
    table(r.topDiscounts, [
      { header: "Player", get: (d) => d.name },
      { header: "Pos", get: (d) => d.position },
      { header: "Team", get: (d) => d.teamName },
      { header: "Worth", get: (d) => money(d.worth), align: "right" },
      { header: "Salary", get: (d) => money(d.salary), align: "right" },
      { header: "Surplus", get: (d) => signedMoney(d.surplus), align: "right" },
    ]),
  );

  console.log(heading("Surplus by team (who's hoarding discounts)"));
  console.log(
    table(r.perTeam, [
      { header: "Team", get: (t) => t.teamName },
      { header: "Keeps", get: (t) => String(t.keptCount), align: "right" },
      { header: "Salaries", get: (t) => money(t.salaries), align: "right" },
      { header: "Worth", get: (t) => money(t.worth), align: "right" },
      { header: "Surplus", get: (t) => signedMoney(t.surplus), align: "right" },
    ]),
  );

  console.log(`\nTip: multiply a keeper board's Worth by ~${r.multiplier.toFixed(2)} to estimate real auction prices.`);
}
