import { getActiveSource, getLeagueId, listValueSources, loadValueMap, sleeper } from "@sgm/core";
import { heading, money, table } from "../format";
import { loadContext, loadKeeperData, pickTeam, teamSurplusBoard } from "@sgm/core";

export async function values(opts: { team?: string }): Promise<void> {
  const active = getActiveSource();
  const sources = listValueSources();
  const players = (await sleeper.getPlayers()) ?? {};

  console.log(heading("Value sources (worth $)"));
  console.log(` Active source:   ${active}${active === "vorp" ? "  (built-in model)" : ""}`);
  console.log(` Available files: ${sources.length ? sources.join(", ") : "(none — only the built-in 'vorp')"}`);
  console.log(` Override: set SGM_VALUE_SOURCE=<name> (e.g. adp, vorp) to switch.`);

  for (const name of sources) {
    const { byId, unmatched } = loadValueMap(name, players);
    console.log(`\n  ${name}: ${byId.size} players matched, ${unmatched.length} unmatched`);
    if (unmatched.length) console.log(`    unmatched e.g.: ${unmatched.slice(0, 6).map((r) => r.name).join(", ")}`);
  }

  if (opts.team) {
    const ctx = await loadContext(getLeagueId());
    const data = await loadKeeperData(ctx);
    const board = teamSurplusBoard(ctx, data, pickTeam(ctx, opts.team)).sort((a, b) => b.worth - a.worth);
    console.log(heading(`Worth on ${pickTeam(ctx, opts.team).teamName} (source: ${active})`));
    console.log(
      table(board, [
        { header: "Player", get: (l) => l.name },
        { header: "Pos", get: (l) => l.position },
        { header: "Worth", get: (l) => money(l.worth), align: "right" },
      ]),
    );
  }
}
