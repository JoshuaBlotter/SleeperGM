import { useEffect, useMemo, useState } from "react";
import { api, type KeeperLine } from "../api";
import { Call, ErrorBox, Loading, Surplus, money, signed, useAsync } from "../ui";
import { clearAllOverrides, clearOverride, recommendation, setOverride, useOverrides } from "../overrides";
import { openPlayer } from "../playerModalStore";
import { hasKept, setKept as storeKept, useKept } from "../keptStore";
import { TargetsView } from "./Targets";

type Line = KeeperLine & { overridden?: boolean };
type Sub = "keepers" | "targets";

/** An editable Worth cell: click to set a custom value; ↺ resets to the source value. */
function WorthCell({ line, onSet, onReset }: { line: Line; onSet: (v: number) => void; onReset: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    const commit = () => {
      const v = Math.round(Number(draft));
      if (draft.trim() !== "" && Number.isFinite(v) && v >= 0) onSet(v);
      setEditing(false);
    };
    return (
      <input
        className="ov-input"
        type="number"
        min={0}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <span className="ov-worth">
      <button
        className={"ov-edit" + (line.overridden ? " overridden" : "")}
        title={line.overridden ? "Custom value — click to change" : "Click to set a custom value"}
        onClick={() => {
          setDraft(String(line.worth));
          setEditing(true);
        }}
      >
        {money(line.worth)}
      </button>
      {line.overridden && (
        <button className="ov-reset" title="Reset to source value" onClick={onReset}>
          ↺
        </button>
      )}
    </span>
  );
}

function Keepers({ teamId, source }: { teamId: number; source?: string }) {
  const [inflated, setInflated] = useState(false);
  const s = useAsync(() => api.team(teamId, inflated, source), [teamId, inflated, source]);
  const ov = useOverrides();
  const [kept, setKept] = useKept(teamId);

  const lines: Line[] = useMemo(() => {
    return (s.data?.lines ?? []).map((l): Line => {
      if (ov[l.playerId] == null) return l;
      const worth = ov[l.playerId]!;
      const surplus = worth - l.keeperCostNextYear;
      return { ...l, worth, surplus, recommendation: recommendation(surplus, worth), overridden: true };
    });
  }, [s.data, ov]);

  // First time this team is opened, seed the shared kept set from the recommended keepers.
  useEffect(() => {
    if (s.data && !hasKept(teamId)) {
      storeKept(teamId, new Set(s.data.lines.filter((l) => l.recommendation === "keep").map((l) => l.playerId)));
    }
  }, [s.data, teamId]);

  const overrideCount = Object.keys(ov).length;
  const budget = s.data?.cap.budget ?? 200;
  const sim = useMemo(() => {
    const chosen = lines.filter((l) => kept.has(l.playerId));
    const used = chosen.reduce((a, l) => a + l.keeperCostNextYear, 0);
    const surplus = chosen.reduce((a, l) => a + l.surplus, 0);
    return { count: chosen.length, used, surplus, left: budget - used };
  }, [lines, kept, budget]);

  if (s.loading) return <Loading what="team" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const over = sim.left < 0;

  const toggle = (id: string) => {
    const n = new Set(kept);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setKept(n);
  };
  const allChecked = lines.length > 0 && kept.size === lines.length;
  const toggleAll = () => setKept(allChecked ? new Set() : new Set(lines.map((l) => l.playerId)));
  const resetRecommended = () => setKept(new Set(lines.filter((l) => l.recommendation === "keep").map((l) => l.playerId)));

  return (
    <>
      <div className="needs" style={{ marginTop: 4 }}>
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
        <span className="dim">Your kept set feeds the Targets tab.</span>
        {overrideCount > 0 && (
          <span className="ov-note">
            {overrideCount} custom value{overrideCount === 1 ? "" : "s"} ·{" "}
            <button className="link" onClick={clearAllOverrides}>
              Reset all
            </button>
          </span>
        )}
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
          {lines.map((l: Line) => (
            <tr key={l.playerId} className={kept.has(l.playerId) ? "kept" : ""}>
              <td>
                <input type="checkbox" checked={kept.has(l.playerId)} onChange={() => toggle(l.playerId)} />
              </td>
              <td>
                <button className="plink" onClick={() => openPlayer(l.playerId)}>{l.name}</button>
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
              <td className="r">
                <WorthCell line={l} onSet={(v) => setOverride(l.playerId, v)} onReset={() => clearOverride(l.playerId)} />
              </td>
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
        <span className="mark">†</span> from league salary sheet · <span className="mark warn">≈</span> approximate ·
        click a <strong>Worth</strong> to set a custom value (saved in this browser). Checked rows = your keepers,
        shared with the <strong>Targets</strong> tab.
      </div>
    </>
  );
}

export function TeamView({ teamId, source }: { teamId: number | null; source?: string }) {
  const [sub, setSub] = useState<Sub>("keepers");
  const meta = useAsync(
    () => (teamId ? api.team(teamId, false, source) : Promise.reject(new Error("Pick a team above"))),
    [teamId, source],
  );
  if (teamId == null) return <div className="notice">Pick a team from the selector above.</div>;

  return (
    <section>
      <div className="head-row">
        <h2>
          {meta.data ? (
            <>
              {meta.data.teamName} <span className="dim">· {meta.data.manager} · {meta.data.record.wins}-{meta.data.record.losses}</span>
            </>
          ) : (
            "Team"
          )}
        </h2>
        <div className="subtabs">
          <button className={sub === "keepers" ? "active" : ""} onClick={() => setSub("keepers")}>
            Keepers
          </button>
          <button className={sub === "targets" ? "active" : ""} onClick={() => setSub("targets")}>
            Targets
          </button>
        </div>
      </div>
      {sub === "keepers" ? <Keepers teamId={teamId} source={source} /> : <TargetsView teamId={teamId} source={source} />}
    </section>
  );
}
