import { useState } from "react";
import { api, type Swap, type TeamRow, type TradePlayer } from "../api";
import { ErrorBox, Loading, Surplus, money, signed, useAsync } from "../ui";

function playerTable(players: TradePlayer[], showTeam = false) {
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

function swapTable(swaps: Swap[], sharky: boolean) {
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Give</th>
          <th>Get</th>
          <th>From</th>
          <th className="r">My surplus</th>
          <th className="r">My cap</th>
          {!sharky && <th>Fit</th>}
        </tr>
      </thead>
      <tbody>
        {swaps.map((s, i) => (
          <tr key={i}>
            <td>
              {s.give.name} <span className="dim">({s.give.position} ${s.give.salary})</span>
            </td>
            <td className="strong">
              {s.get.name} <span className="dim">({s.get.position} ${s.get.salary})</span>
            </td>
            <td className="dim">{s.get.teamName}</td>
            <td className="r">{signed(s.myGain)}</td>
            <td className="r">{signed(s.capRelief)}</td>
            {!sharky && (
              <td>
                <span className="chip chip-solid chip-success">both ✓</span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
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
                  {playerTable(d.myChips)}
                </div>
                <div>
                  <h3>Dead weight (shop these)</h3>
                  {d.myDeadWeight.length ? playerTable(d.myDeadWeight) : <p className="dim">None.</p>}
                </div>
              </div>

              <h3>Buy-low targets{partnerName ? ` on ${partnerName}` : " on other rosters"}</h3>
              {d.targets.length ? playerTable(d.targets, true) : <p className="dim">None.</p>}

              <h3>
                {sharky ? "Sharky swaps — maximize your surplus" : "Mutual-fit trades — both teams fill a need"}
                {partnerName ? ` (with ${partnerName})` : ""}
              </h3>
              {swaps.length ? (
                swapTable(swaps, sharky)
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
