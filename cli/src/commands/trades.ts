import { computeTrades, getLeagueId, type SwapSuggestion, type TradePlayer } from "@sgm/core";
import { heading, money, signedMoney, table } from "../format";
import { STREAMER_POSITIONS, loadContext, loadKeeperData, pickTeam, teamSurplusBoard } from "@sgm/core";

export async function trades(query: string, opts: { partner?: string; top?: string; sharky?: boolean }): Promise<void> {
  if (!query) throw new Error("trades requires a team: sgm trades <name|#> [--partner X] [--sharky]");
  const ctx = await loadContext(getLeagueId());
  const me = pickTeam(ctx, query);
  const partner = opts.partner ? pickTeam(ctx, opts.partner) : undefined;
  const top = opts.top ? Number(opts.top) : 12;
  const data = await loadKeeperData(ctx);

  const all: TradePlayer[] = [];
  for (const t of ctx.registry) {
    for (const l of teamSurplusBoard(ctx, data, t)) {
      if (STREAMER_POSITIONS.has(l.position)) continue; // K/DEF have no trade value
      all.push({ playerId: l.playerId, name: l.name, position: l.position, teamId: t.rosterId, teamName: t.teamName, worth: l.worth, salary: l.keeperCostNextYear, surplus: l.surplus });
    }
  }

  const r = computeTrades(all, me.rosterId, { partnerTeamId: partner?.rosterId, top, rosterPositions: ctx.rosterPositions });

  console.log(heading(`Trade explorer — ${me.teamName}${partner ? ` ↔ ${partner.teamName}` : " (whole league)"}`));

  console.log(`\nYour roster fit (starting-lineup need by position):`);
  console.log(
    r.myNeeds.map((n) => `  ${n.position}: ${n.need > 0 ? `need ${n.need}` : n.need < 0 ? `depth ${-n.need}` : "set"}`).join("   "),
  );

  console.log(`\nYour trade chips (surplus assets others may want):`);
  console.log(chipTable(r.myChips.slice(0, top)));

  console.log(`\nYour dead weight (overpriced — shop these):`);
  console.log(r.myDeadWeight.length ? chipTable(r.myDeadWeight.slice(0, top)) : "  (none)");

  console.log(`\nBuy-low targets on other rosters (cheap studs to ask for):`);
  console.log(
    table(r.targets, [
      { header: "Player", get: (p) => p.name },
      { header: "Pos", get: (p) => p.position },
      { header: "Team", get: (p) => p.teamName },
      { header: "Worth", get: (p) => money(p.worth), align: "right" },
      { header: "Salary", get: (p) => money(p.salary), align: "right" },
      { header: "Surplus", get: (p) => signedMoney(p.surplus), align: "right" },
    ]),
  );

  if (opts.sharky) {
    console.log(`\nSharky swaps — maximize YOUR surplus (partner loses the same):`);
    console.log(swapTable(r.swaps));
    console.log(`\n(1-for-1 surplus is zero-sum; these favor you. Use the default view for balanced deals.)`);
  } else {
    console.log(`\nMutual-fit trades — both teams fill a positional need from depth (fair value):`);
    if (!r.fairSwaps.length) {
      console.log("  (none found — try --sharky for surplus-max swaps, or --partner to widen the search)");
    } else {
      console.log(swapTable(r.fairSwaps, true));
    }
    console.log(`\nBoth sides fill a need at ≤$15 surplus swing. Add --sharky to see one-sided, surplus-max swaps.`);
  }
}

function swapTable(swaps: SwapSuggestion[], showFit = false): string {
  return table(swaps, [
    { header: "Give", get: (s) => `${s.give.name} (${s.give.position} $${s.give.salary})` },
    { header: "Get", get: (s) => `${s.get.name} (${s.get.position} $${s.get.salary})` },
    { header: "From", get: (s) => s.get.teamName },
    { header: "MySurplus", get: (s) => signedMoney(s.myGain), align: "right" },
    { header: "MyCap", get: (s) => signedMoney(s.capRelief), align: "right" },
    ...(showFit ? [{ header: "Fit", get: (s: SwapSuggestion) => "both ✓" }] : []),
  ]);
}

function chipTable(players: TradePlayer[]): string {
  return table(players, [
    { header: "Player", get: (p) => p.name },
    { header: "Pos", get: (p) => p.position },
    { header: "Worth", get: (p) => money(p.worth), align: "right" },
    { header: "Salary", get: (p) => money(p.salary), align: "right" },
    { header: "Surplus", get: (p) => signedMoney(p.surplus), align: "right" },
  ]);
}
