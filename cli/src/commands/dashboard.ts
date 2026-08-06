import { getLeagueId, leagueRules } from "@sgm/core";
import { heading, record, table } from "../format";
import { loadContext } from "@sgm/core";

export async function dashboard(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  console.log(heading(`League: ${ctx.season} · ${ctx.registry.length} teams · $${leagueRules.capBudget} cap`));
  console.log(
    table(ctx.registry, [
      { header: "#", get: (t) => String(t.rosterId), align: "right" },
      { header: "Team", get: (t) => t.teamName },
      { header: "Manager", get: (t) => t.displayName },
      { header: "Record", get: (t) => record(t.wins, t.losses, t.ties), align: "right" },
      { header: "Players", get: (t) => String(t.players.length), align: "right" },
      { header: "Taxi", get: (t) => String(t.taxi.length), align: "right" },
    ]),
  );
  console.log(`\nTip: 'sgm team <name|#>' for a single roster with keeper costs.`);
}
