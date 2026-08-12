import { leagueRules, outstandingRules } from "@sgm/core";
import { heading } from "../format";

export function rulebook(): void {
  const r = leagueRules;
  const outstanding = outstandingRules(r);

  if (outstanding.length) {
    console.log("\n⚠  OUTSTANDING RULES (currently faked with placeholders)");
    console.log("".padEnd(58, "-"));
    for (const o of outstanding) console.log(` • ${o}`);
  }

  console.log(heading("Resolved house rules"));
  console.log(` Cap budget (auction):     $${r.capBudget}`);
  console.log(` Max keepers:              ${r.maxKeepers} (effectively unlimited)`);
  console.log(` Keeper escalation (§6.1): each offseason, new = old salary + increase, where increase is`);
  const pb = r.keeperEscalation.positionalBase;
  console.log(`     skill:  positional base + years kept  (QB +$${pb["QB"]}, RB +$${pb["RB"]}, WR +$${pb["WR"]}, TE +$${pb["TE"]}, then + yrs)`);
  console.log(`     K/DEF:  +$${r.keeperEscalation.flatIncrease}/yr`);
  console.log(` Waiver keeper cost:       = FAAB bid paid to acquire (§6.2)`);
  console.log(` Cut & re-acquire:         cost resets to new acquisition price (§6.3)`);
  console.log(` Rookie starting salary:   by draft slot (1-12) x position, §6.4:`);
  console.log(renderRookieTable(r));
  console.log(` Trade carryover (§6.6):   traded players keep original basis, then escalate`);
  console.log(` Taxi / IR vs cap:         COUNT against cap; priced like any player (§6.5)`);
  console.log(`\nSource of truth: core/src/config/league-rules.ts`);
}

function renderRookieTable(r = leagueRules): string {
  const rows: string[] = ["     slot   QB  RB  WR  TE"];
  for (let s = 1; s <= 12; s++) {
    const row = r.rookieCost.table[String(s)] ?? {};
    const cell = (p: string) => String(row[p] ?? "-").padStart(2);
    rows.push(`     ${String(s).padStart(4)}   ${cell("QB")}  ${cell("RB")}  ${cell("WR")}  ${cell("TE")}`);
  }
  return rows.join("\n");
}
