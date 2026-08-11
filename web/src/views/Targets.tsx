import { useMemo, useState } from "react";
import { api, type ScoredTarget, type TargetCandidate } from "../api";
import { ErrorBox, Loading, money, useAsync } from "../ui";
import { openPlayer } from "../playerModalStore";
import { useKept } from "../keptStore";

// NOTE: mirrors core/engines/draftTargets.ts (computeDraftTargets + positionalNeeds). The static site
// has no server, so scoring runs client-side against your live kept set. Keep the two in sync.
const SKILL = ["QB", "RB", "WR", "TE"];

function needsFrom(kept: TargetCandidate[], starterSlots: Record<string, number>): Record<string, number> {
  const have: Record<string, number> = {};
  for (const p of kept) if (SKILL.includes(p.position)) have[p.position] = (have[p.position] ?? 0) + 1;
  const need: Record<string, number> = {};
  for (const pos of SKILL) need[pos] = (starterSlots[pos] ?? 0) - (have[pos] ?? 0);
  return need;
}

function scoreTargets(
  candidates: TargetCandidate[],
  needs: Record<string, number>,
  keptQbs: { name: string; nflTeam: string | null }[],
  teamCounts: Record<string, number>,
): ScoredTarget[] {
  const qbTeams = new Set(keptQbs.map((q) => q.nflTeam).filter(Boolean) as string[]);
  return candidates
    .map((c): ScoredTarget => {
      const need = needs[c.position] ?? 0;
      const fillsNeed = need > 0;
      const stack = (c.position === "WR" || c.position === "TE") && !!c.nflTeam && qbTeams.has(c.nflTeam);
      const conc = c.nflTeam ? teamCounts[c.nflTeam] ?? 0 : 0;
      const overStacked = conc >= 2;
      let score = c.worth * (fillsNeed ? 1 + 0.25 * Math.min(need, 2) : 0.6);
      if (stack) score += 0.15 * c.worth;
      if (overStacked) score -= 0.12 * c.worth;
      const reasons: string[] = [];
      reasons.push(fillsNeed ? `fills ${c.position} need` : `depth at ${c.position}`);
      if (stack) reasons.push(`stacks with ${keptQbs.find((q) => q.nflTeam === c.nflTeam)?.name ?? "your QB"}`);
      if (overStacked) reasons.push(`⚠ ${conc} kept from ${c.nflTeam}`);
      if (c.tier) reasons.push(`${c.position} tier ${c.tier}`);
      return { ...c, score: Math.round(score * 10) / 10, reasons, fillsNeed, stack, overStacked };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
}

export function TargetsView({ teamId, source }: { teamId: number; source?: string }) {
  const league = useAsync(() => api.league(source), [source]);
  const pool = useAsync(() => api.targetPool(source), [source]);
  const [kept] = useKept(teamId);
  const [assumeAll, setAssumeAll] = useState(false);

  const result = useMemo(() => {
    if (!pool.data || !league.data) return null;
    const starterSlots = league.data.starterSlots ?? { QB: 1, RB: 2, WR: 2, TE: 1 };
    const myRoster = pool.data.filter((c) => c.ownerTeamId === teamId);
    const keptPlayers = myRoster.filter((c) => kept.has(c.playerId));
    const needs = needsFrom(keptPlayers, starterSlots);
    const keptQbs = keptPlayers.filter((c) => c.position === "QB").map((c) => ({ name: c.name, nflTeam: c.nflTeam }));
    const teamCounts: Record<string, number> = {};
    for (const c of keptPlayers) if (c.nflTeam) teamCounts[c.nflTeam] = (teamCounts[c.nflTeam] ?? 0) + 1;
    const available = pool.data.filter((c) => c.ownerTeamId !== teamId && (assumeAll || !c.projectedKeeper));
    return { targets: scoreTargets(available, needs, keptQbs, teamCounts), needs, keptCount: keptPlayers.length, availCount: available.length };
  }, [pool.data, league.data, kept, teamId, assumeAll]);

  if (pool.loading || league.loading) return <Loading what="draft targets" />;
  if (pool.error) return <ErrorBox message={pool.error} />;
  if (!result) return <ErrorBox message="No target data." />;

  const needChips = SKILL.map((pos) => ({ pos, need: result.needs[pos] ?? 0 }));
  const teamName = new Map((league.data?.teams ?? []).map((t) => [t.rosterId, t.teamName] as const));

  return (
    <>
      <p className="dim" style={{ marginTop: 0 }}>
        Who to target in the auction, based on <strong>your {result.keptCount} kept players</strong> (checked on the
        Keepers tab). Blends positional need, value/tier, QB-stacks, and NFL-team diversity. Click a name for the
        drilldown.
      </p>

      <div className="needs">
        Roster after keepers:{" "}
        {needChips.map((n) => (
          <span key={n.pos} className={"chip " + (n.need > 0 ? "chip-solid chip-warning" : n.need < 0 ? "chip-solid chip-success" : "chip-neutral")}>
            {n.pos}: {n.need > 0 ? `need ${n.need}` : n.need < 0 ? `depth ${-n.need}` : "set"}
          </span>
        ))}
        <label className="toggle" style={{ marginLeft: "auto" }}>
          <input type="checkbox" checked={assumeAll} onChange={(e) => setAssumeAll(e.target.checked)} /> Assume everyone
          available
        </label>
      </div>

      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th className="r">#</th>
              <th>Player</th>
              <th>Pos</th>
              <th>NFL</th>
              <th className="r">Worth</th>
              <th>Avail</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {result.targets.map((t: ScoredTarget, i) => (
              <tr key={t.playerId}>
                <td className="r dim">{i + 1}</td>
                <td>
                  <button className="plink" onClick={() => openPlayer(t.playerId)}>{t.name}</button>
                </td>
                <td>
                  <span className={"pos pos-" + t.position}>{t.position}</span>
                </td>
                <td className="dim">{t.nflTeam ?? "—"}</td>
                <td className="r">{money(t.worth)}</td>
                <td>
                  {t.ownerTeamId == null ? (
                    <span className="chip chip-solid chip-success">FA</span>
                  ) : (
                    <span className="chip chip-solid chip-warning" title="rostered but projected to be cut → back to the auction">
                      cut? {teamName.get(t.ownerTeamId) ?? "?"}
                    </span>
                  )}
                </td>
                <td>
                  <span className="why">
                    {t.reasons.map((r, j) => (
                      <span
                        key={j}
                        className={
                          "chip " +
                          (r.startsWith("fills")
                            ? "chip-solid chip-success"
                            : r.startsWith("stacks")
                              ? "chip-solid chip-accent"
                              : r.startsWith("⚠")
                                ? "chip-solid chip-warning"
                                : "chip-neutral")
                        }
                      >
                        {r}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        Availability is a projection: players worth ≥ their keeper cost are assumed kept (off the board) until managers
        lock — toggle <strong>Assume everyone available</strong> to ignore that. {result.availCount} available.
      </div>
    </>
  );
}
