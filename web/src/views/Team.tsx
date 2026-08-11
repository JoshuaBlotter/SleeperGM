import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { api, type KeeperLine } from "../api";
import { Row, RowList } from "../Row";
import { Call, ErrorBox, Loading, Surplus, money, signed, useAsync, useIsDesktop } from "../ui";
import { clearAllOverrides, clearOverride, recommendation, setOverride, useOverrides } from "../overrides";
import { openPlayer } from "../playerModalStore";
import { hasKept, setKept as storeKept, useKept } from "../keptStore";
import { TargetsView } from "./Targets";

type Line = KeeperLine & { overridden?: boolean };
type Sub = "keepers" | "targets";

/** Salary provenance: † from the league sheet, ≈ approximate. Data notation, not icons — kept as-is. */
function SalaryMark({ line }: { line: Line }) {
  if (line.salarySource === "sheet") return <sup className="mark">†</sup>;
  if (line.approximate) return <sup className="mark warn">≈</sup>;
  return null;
}

function acquired(l: Line): string {
  return l.acquiredVia === "rookie" && l.rookiePick
    ? `rookie ${l.rookiePick.round}.${String(l.rookiePick.slot).padStart(2, "0")}`
    : l.acquiredVia;
}

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
  const isDesktop = useIsDesktop();

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
      <div className="toolbar">
        <label className="toggle">
          <input type="checkbox" checked={inflated} onChange={(e) => setInflated(e.target.checked)} /> Inflation-adjusted
          worth {d.inflated ? `(×${d.multiplier.toFixed(2)})` : ""}
        </label>
      </div>

      {isDesktop && (
        <>
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

          <div className="toolbar">
            <button className="btn btn-secondary" onClick={resetRecommended}>
              Reset to recommended
            </button>
            <span className="dim">Your kept set feeds the Targets tab.</span>
          </div>
        </>
      )}

      {overrideCount > 0 && (
        <div className="toolbar">
          <span className="ov-note">
            {overrideCount} custom value{overrideCount === 1 ? "" : "s"} ·{" "}
            <button className="btn btn-ghost" onClick={clearAllOverrides}>
              Reset all
            </button>
          </span>
        </div>
      )}

      {isDesktop ? (
        <table className="grid">
          <thead>
            <tr>
              <th className="check-col">
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
                  <SalaryMark line={l} />
                </td>
                <td>
                  <span className={"pos pos-" + l.position}>{l.position}</span>
                </td>
                <td className="dim">{acquired(l)}</td>
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
      ) : (
        <RowList>
          {lines.map((l: Line) => (
            <Row
              key={l.playerId}
              selected={kept.has(l.playerId)}
              leading={
                <input
                  type="checkbox"
                  checked={kept.has(l.playerId)}
                  onChange={() => toggle(l.playerId)}
                  aria-label={`Keep ${l.name}`}
                />
              }
              title={
                <>
                  <button className="plink" onClick={() => openPlayer(l.playerId)}>
                    {l.name}
                  </button>
                  <SalaryMark line={l} />
                  <span className={"pos pos-" + l.position}>{l.position}</span>
                </>
              }
              meta={`keep ${money(l.keeperCostNextYear)} · worth ${money(l.worth)} · ${acquired(l)}`}
              metric={signed(l.surplus)}
              metricRole={l.surplus > 0 ? "success" : l.surplus < 0 ? "danger" : "muted"}
              metricLabel={<Call rec={l.recommendation} />}
              details={[
                {
                  k: "Worth",
                  v: <WorthCell line={l} onSet={(v) => setOverride(l.playerId, v)} onReset={() => clearOverride(l.playerId)} />,
                },
                { k: "Keep $", v: money(l.keeperCostNextYear) },
                { k: "Acquired", v: acquired(l) },
                { k: "Years kept", v: l.yearsKept },
              ]}
            />
          ))}
        </RowList>
      )}
      <div className="legend">
        <span className="mark">†</span> from league salary sheet · <span className="mark warn">≈</span> approximate ·
        tap a row to edit its <strong>Worth</strong> (saved in this browser). Checked rows = your keepers, shared with
        the <strong>Targets</strong> tab.
      </div>

      {!isDesktop && (
        <>
          <div className="sim-spacer" />
          <div className={"sim-bar" + (over ? " is-over" : "")}>
            <div className="sim-figs">
              <div className="sim-fig cap">
                <span className="v">{money(Math.abs(sim.left))}</span>
                <span className="k">cap {over ? "over by" : "left"}</span>
              </div>
              <div className="sim-fig">
                <span className="v">{sim.count}</span>
                <span className="k">keeping</span>
              </div>
            </div>
            <button
              className="btn btn-secondary push"
              onClick={resetRecommended}
              title="Reset to recommended"
              aria-label="Reset to recommended"
            >
              <RotateCcw size={18} strokeWidth={1.5} /> Reset
            </button>
            <div className="sim-meta">
              used {money(sim.used)} / ${budget} · sim surplus {signed(sim.surplus)}
            </div>
          </div>
        </>
      )}
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
        <div className="seg">
          <button className={sub === "keepers" ? "is-on" : ""} onClick={() => setSub("keepers")}>
            Keepers
          </button>
          <button className={sub === "targets" ? "is-on" : ""} onClick={() => setSub("targets")}>
            Targets
          </button>
        </div>
      </div>
      {sub === "keepers" ? <Keepers teamId={teamId} source={source} /> : <TargetsView teamId={teamId} source={source} />}
    </section>
  );
}
