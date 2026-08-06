import { useEffect, useMemo, useState } from "react";
import { api, type KeeperLine } from "../api";
import { Call, ErrorBox, Loading, Surplus, money, signed, useAsync } from "../ui";

export function TeamView({ teamId }: { teamId: number | null }) {
  const [inflated, setInflated] = useState(false);
  const s = useAsync(
    () => (teamId ? api.team(teamId, inflated) : Promise.reject(new Error("Pick a team above"))),
    [teamId, inflated],
  );

  // Interactive keeper simulation: which players are "kept". Seeded from the keep/hold/cut call.
  const [kept, setKept] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (s.data) setKept(new Set(s.data.lines.filter((l) => l.recommendation === "keep").map((l) => l.playerId)));
  }, [s.data]);

  const lines = s.data?.lines ?? [];
  const budget = s.data?.cap.budget ?? 200;
  const sim = useMemo(() => {
    const chosen = lines.filter((l) => kept.has(l.playerId));
    const used = chosen.reduce((a, l) => a + l.keeperCostNextYear, 0);
    const surplus = chosen.reduce((a, l) => a + l.surplus, 0);
    return { count: chosen.length, used, surplus, left: budget - used };
  }, [lines, kept, budget]);

  if (teamId == null) return <div className="notice">Pick a team from the selector above.</div>;
  if (s.loading) return <Loading what="team" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const over = sim.left < 0;

  const toggle = (id: string) =>
    setKept((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = lines.length > 0 && kept.size === lines.length;
  const toggleAll = () => setKept(allChecked ? new Set() : new Set(lines.map((l) => l.playerId)));
  const resetRecommended = () =>
    setKept(new Set(lines.filter((l) => l.recommendation === "keep").map((l) => l.playerId)));

  return (
    <section>
      <div className="head-row">
        <h2>
          {d.teamName} <span className="dim">· {d.manager} · {d.record.wins}-{d.record.losses}</span>
        </h2>
        <label className="toggle">
          <input type="checkbox" checked={inflated} onChange={(e) => setInflated(e.target.checked)} /> Inflation-adjusted
          worth {d.inflated ? `(×${d.multiplier.toFixed(2)})` : ""}
        </label>
      </div>

      <div className="cards">
        <div className="card">
          <div className="k">Keeping</div>
          <div className="v">{sim.count}</div>
          <div className="k">check rows to simulate</div>
        </div>
        <div className="card">
          <div className="k">Sim cap used</div>
          <div className="v">
            {money(sim.used)} <span className="dim">/ ${budget}</span>
          </div>
        </div>
        <div className={"card " + (over ? "bad" : "good")}>
          <div className="k">Cap {over ? "over by" : "left for auction"}</div>
          <div className="v">{money(Math.abs(sim.left))}</div>
        </div>
        <div className="card">
          <div className="k">Sim surplus</div>
          <div className="v">{signed(sim.surplus)}</div>
        </div>
      </div>

      <div className="needs">
        <button className="refresh" onClick={resetRecommended}>
          Reset to recommended
        </button>
        <span className="dim">If all kept: {money(d.cap.used)} / ${d.cap.budget}</span>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th style={{ width: 28 }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} title="Select all" />
            </th>
            <th>Player</th>
            <th>Pos</th>
            <th>Acquired</th>
            <th className="r">Worth</th>
            <th className="r">Keep $</th>
            <th className="r">Surplus</th>
            <th>Call</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l: KeeperLine) => (
            <tr key={l.playerId} className={kept.has(l.playerId) ? "kept" : ""}>
              <td>
                <input type="checkbox" checked={kept.has(l.playerId)} onChange={() => toggle(l.playerId)} />
              </td>
              <td className="strong">
                {l.name}
                {l.salarySource === "sheet" ? <sup className="mark">†</sup> : l.approximate ? <sup className="mark warn">≈</sup> : null}
              </td>
              <td>
                <span className={"pos pos-" + l.position}>{l.position}</span>
              </td>
              <td className="dim">
                {l.acquiredVia === "rookie" && l.rookiePick
                  ? `rookie ${l.rookiePick.round}.${String(l.rookiePick.slot).padStart(2, "0")}`
                  : l.acquiredVia}
              </td>
              <td className="r">{money(l.worth)}</td>
              <td className="r">{money(l.keeperCostNextYear)}</td>
              <td className="r">
                <Surplus value={l.surplus} />
              </td>
              <td>
                <Call rec={l.recommendation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend">
        <span className="mark">†</span> from league salary sheet · <span className="mark warn">≈</span> approximate
        (traded / pre-2022 history)
      </div>
    </section>
  );
}
