import { getLeagueId, leagueRules, loadContext, loadRookieBoard } from "@sgm/core";
import { heading, money, record, table } from "../format";

/** Format the round-1 slot cost as a compact per-position string: "RB $12 · WR $8 · TE $6 · QB $2". */
function costStr(cost: Record<string, number>): string {
  const order = ["QB", "RB", "WR", "TE"];
  const parts = order.filter((p) => cost[p] != null).map((p) => `${p} ${money(cost[p]!)}`);
  return parts.length ? parts.join(" · ") : "—";
}

export async function rookies(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const board = await loadRookieBoard(ctx);

  console.log(heading(`Rookie draft board — ${board.season} (${board.rounds} round${board.rounds === 1 ? "" : "s"}${board.snake ? ", snake" : ""})`));
  console.log(` DERIVED: Sleeper doesn't publish the ${board.season} rookie order. Base = reverse of last`);
  console.log(` season's regular-season standings (wins, then points); traded picks applied from Sleeper.`);
  if (leagueRules.rookieDraft.roundsAssumed)
    console.log(` NOTE: round count assumed = ${board.rounds}. Set rookieDraft.rounds in league-rules.ts to correct.`);

  console.log(
    "\n" +
      table(board.picks, [
        { header: "Pick", get: (p) => p.label },
        { header: "Owner", get: (p) => p.ownerTeam },
        { header: "Via", get: (p) => (p.traded ? `via ${p.viaTeam}` : "") },
        { header: "Slot cost (by pos)", get: (p) => costStr(p.cost) },
      ]),
  );

  console.log(heading("Draft capital by team"));
  console.log(
    table(board.byTeam, [
      { header: "Team", get: (t) => t.teamName },
      { header: "Picks", get: (t) => (t.picks.length ? t.picks.join(", ") : "—") },
      { header: "Net", get: (t) => (t.extra > 0 ? `+${t.extra}` : t.extra < 0 ? String(t.extra) : "0"), align: "right" },
    ]),
  );

  console.log(heading("Base order (reverse 2025 regular-season standings)"));
  console.log(
    table(board.baseOrder, [
      { header: "Slot", get: (s) => String(s.slot), align: "right" },
      { header: "Team", get: (s) => s.teamName },
      { header: "2025 record", get: (s) => record(s.wins, s.losses, s.ties) },
      { header: "Points for", get: (s) => s.pointsFor.toFixed(2), align: "right" },
    ]),
  );

  // Rookie prospects — the incoming class ranked by value (deeper than 12 so stretch picks show).
  console.log(heading(`Rookie prospects — ranked by ${board.prospectSource || "value"} (${board.prospects.length})`));
  if (!board.prospects.length) {
    console.log(` No rookie values from '${board.prospectSource}'.`);
  } else {
    console.log(
      table(board.prospects, [
        { header: "#", get: (p) => String(p.rank), align: "right" },
        { header: "Player", get: (p) => p.name },
        { header: "Pos", get: (p) => p.position },
        { header: "NFL", get: (p) => p.nflTeam ?? "—" },
        { header: "Value", get: (p) => money(p.value), align: "right" },
      ]),
    );
  }
}
