import { useState } from "react";
import { api, type Swap, type TeamRow, type TradePlayer } from "../api";
import { Row, RowList } from "../Row";
import { ErrorBox, Loading, Surplus, money, signed, useAsync, useIsDesktop } from "../ui";

/** Colors a trailing metric that can go either way. */
function sign(n: number): "success" | "danger" | "muted" {
  return n > 0 ? "success" : n < 0 ? "danger" : "muted";
}

function PlayerList({ players, showTeam = false }: { players: TradePlayer[]; showTeam?: boolean }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <table className="grid">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            {showTeam && <th>Team</th>}
            <th className="r">Worth</th>
            <th className="r">Salary</th>
            <th className="r">Surplus</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId}>
              <td className="strong">{p.name}</td>
              <td>
                <span className={"pos pos-" + p.position}>{p.position}</span>
              </td>
              {showTeam && <td className="dim">{p.teamName}</td>}
              <td className="r">{money(p.worth)}</td>
              <td className="r">{money(p.salary)}</td>
              <td className="r">
                <Surplus value={p.surplus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <RowList>
      {players.map((p) => (
        <Row
          key={p.playerId}
          title={
            <>
              <span>{p.name}</span>
              <span className={"pos pos-" + p.position}>{p.position}</span>
            </>
          }
          meta={showTeam ? p.teamName : undefined}
          metric={signed(p.surplus)}
          metricLabel="surplus"
          metricRole={sign(p.surplus)}
          details={[
            { k: "worth", v: money(p.worth) },
            { k: "salary", v: money(p.salary) },
          ]}
        />
      ))}
    </RowList>
  );
}

/**
 * One swap, readable without scrolling sideways: give above, get below, the two deltas
 * trailing. Sharky and mutual-fit are told apart by the accent border and the footer mark,
 * not just by the heading above the list.
 */
function SwapCard({ s, sharky }: { s: Swap; sharky: boolean }) {
  const side = (label: string, p: TradePlayer) => (
    <div className="swap-side">
      <span className="swap-k">{label}</span>
      <span className="swap-name">{p.name}</span>
      <span className={"pos pos-" + p.position}>{p.position}</span>
    </div>
  );
  return (
    <div className={"swap" + (sharky ? " is-sharky" : "")}>
      <div className="swap-main">
        <div className="swap-sides">
          {side("give", s.give)}
          {side("get", s.get)}
        </div>
        <div className="swap-metrics">
          <div className={"swap-metric is-" + sign(s.myGain)}>
            <span className="v">{signed(s.myGain)}</span>
            <span className="k">my surplus</span>
          </div>
          <div className={"swap-metric is-" + sign(s.capRelief)}>
            <span className="v">{signed(s.capRelief)}</span>
            <span className="k">my cap</span>
          </div>
        </div>
      </div>
      <div className="swap-foot">
        <span>from {s.get.teamName}</span>
        <span>
          {money(s.give.salary)} → {money(s.get.salary)}
        </span>
        {sharky ? (
          <span className="chip chip-solid chip-warning">favors you</span>
        ) : (
          <span className="chip chip-solid chip-success">both fill a need</span>
        )}
      </div>
    </div>
  );
}

export function TradesView({ teamId, teams, source }: { teamId: number | null; teams: TeamRow[]; source?: string }) {
  const [partner, setPartner] = useState("");
  const [sharky, setSharky] = useState(false);
  const s = useAsync(
    () => (teamId ? api.trades(teamId, partner || undefined, source) : Promise.reject(new Error("Pick a team above"))),
    [teamId, partner, source],
  );
  if (teamId == null) return <div className="notice">Pick a team from the selector above.</div>;

  const partnerName = teams.find((t) => String(t.rosterId) === partner)?.teamName;

  return (
    <section>
      <div className="head-row">
        <h2>Trade Explorer</h2>
      </div>
      <div className="toolbar">
        <select value={partner} onChange={(e) => setPartner(e.target.value)} aria-label="Trade partner">
          <option value="">All partners</option>
          {teams
            .filter((t) => t.rosterId !== teamId)
            .map((t) => (
              <option key={t.rosterId} value={t.rosterId}>
                vs {t.teamName}
              </option>
            ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={sharky} onChange={(e) => setSharky(e.target.checked)} /> Sharky (surplus-max)
        </label>
      </div>

      {s.loading ? (
        <Loading what="trades" />
      ) : s.error ? (
        <ErrorBox message={s.error} />
      ) : (
        (() => {
          const d = s.data!;
          const swaps = sharky ? d.swaps : d.fairSwaps;
          return (
            <>
              <div className="needs">
                Roster fit:{" "}
                {d.myNeeds.map((n) => (
                  <span key={n.position} className={"chip " + (n.need > 0 ? "chip-solid chip-warning" : n.need < 0 ? "chip-solid chip-success" : "chip-neutral")}>
                    {n.position}: {n.need > 0 ? `need ${n.need}` : n.need < 0 ? `depth ${-n.need}` : "set"}
                  </span>
                ))}
              </div>

              <div className="two-col">
                <div>
                  <h3>Your chips</h3>
                  <PlayerList players={d.myChips} />
                </div>
                <div>
                  <h3>Dead weight (shop these)</h3>
                  {d.myDeadWeight.length ? <PlayerList players={d.myDeadWeight} /> : <p className="dim">None.</p>}
                </div>
              </div>

              <h3>Buy-low targets{partnerName ? ` on ${partnerName}` : " on other rosters"}</h3>
              {d.targets.length ? <PlayerList players={d.targets} showTeam /> : <p className="dim">None.</p>}

              <h3>
                {sharky ? "Sharky swaps — maximize your surplus" : "Mutual-fit trades — both teams fill a need"}
                {partnerName ? ` (with ${partnerName})` : ""}
              </h3>
              {swaps.length ? (
                <div className="swap-list">
                  {swaps.map((sw, i) => (
                    <SwapCard key={i} s={sw} sharky={sharky} />
                  ))}
                </div>
              ) : (
                <p className="dim">
                  {sharky
                    ? "No comparable-worth swaps found."
                    : "None — this roster lacks surplus depth to trade from. Try the Sharky toggle for one-sided salary-dump swaps."}
                </p>
              )}
              <p className="dim">
                {sharky
                  ? "1-for-1 surplus is zero-sum — these favor you; the partner loses the same. Pitch ones that fill their positional need."
                  : "Both sides fill a need at ≤$15 surplus swing."}
              </p>
            </>
          );
        })()
      )}
    </section>
  );
}
