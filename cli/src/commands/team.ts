import { getLeagueId, summarizeCap, type KeeperLine } from "@sgm/core";
import { heading, money, record, table } from "../format";
import { loadContext, loadKeeperData, pickTeam, teamKeeperLines } from "@sgm/core";

function via(l: KeeperLine): string {
  if (l.acquiredVia === "rookie" && l.rookiePick) {
    return `rookie ${l.rookiePick.round}.${String(l.rookiePick.slot).padStart(2, "0")}`;
  }
  return l.acquiredVia;
}

export async function team(query: string): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const t = pickTeam(ctx, query);
  const data = await loadKeeperData(ctx);
  const lines = teamKeeperLines(ctx, data, t);
  lines.sort((a, b) => b.keeperCostNextYear - a.keeperCostNextYear);

  const cap = summarizeCap(lines.map((l) => l.keeperCostNextYear));
  const anyApprox = lines.some((l) => l.approximate);
  const anySheet = lines.some((l) => l.salarySource === "sheet");

  console.log(heading(`${t.teamName} (#${t.rosterId}) · ${t.displayName} · ${record(t.wins, t.losses, t.ties)}`));
  console.log(
    table(lines, [
      { header: "Player", get: (l) => l.name },
      { header: "Pos", get: (l) => l.position },
      { header: "Via", get: (l) => via(l) },
      { header: "Acq$", get: (l) => (l.costKnown ? money(l.baseCost) : "—"), align: "right" },
      { header: "Yrs", get: (l) => String(l.yearsKept), align: "right" },
      { header: "'26 Keep$", get: (l) => keep(l), align: "right" },
    ]),
  );
  console.log(
    `\nIf all kept: ${money(cap.capUsed)} of $${cap.capBudget} (${money(cap.capAvailable)} left) across ${cap.count} players.`,
  );
  console.log(`\nAcq$ = prior-season salary (†) or your acquisition salary (computed); Keep$ = projected 2026 salary.`);
  if (anySheet) console.log(`  † from the league salary sheet (config/salaries.csv).`);
  if (anyApprox)
    console.log(`  ≈ approximate: player was traded and/or has pre-2022 history the API can't see. Import the salary sheet for exact numbers.`);
}

function keep(l: KeeperLine): string {
  if (!l.costKnown) return "?";
  const mark = l.salarySource === "sheet" ? "†" : l.approximate ? "≈" : "";
  return `${money(l.keeperCostNextYear)}${mark}`;
}
