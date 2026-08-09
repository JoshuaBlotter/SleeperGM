import { useEffect } from "react";
import { api, type PlayerDetail } from "./api";
import { money, useAsync } from "./ui";
import { closePlayer, useOpenPlayer } from "./playerModalStore";

const ARCHETYPE_BLURB: Record<string, string> = {
  consistent: "Steady week to week — you knew what you'd get.",
  steady: "Fairly reliable with some week-to-week swing.",
  "boom-bust": "High variance — league-winner weeks and duds in equal measure.",
  "one-week-wonder": "One big week carried the season total; otherwise thin.",
  "injury-limited": "Missed significant time — small sample.",
};

function WeekBars({ weekly, boomLine, bustLine }: { weekly: number[]; boomLine: number; bustLine: number }) {
  const max = Math.max(1, ...weekly);
  return (
    <div className="wk-chart" role="img" aria-label="weekly fantasy points">
      {weekly.map((pts, i) => {
        // Same thresholds the boom/bust counts use, so bar colors match the header exactly.
        const band = pts >= boomLine ? "boom" : pts <= bustLine ? "bust" : "mid";
        return (
          <div className="wk-col" key={i} title={`Wk ${i + 1}: ${pts}`}>
            <div className={"wk-bar " + band} style={{ height: `${Math.max(3, (pts / max) * 100)}%` }} />
            <span className="wk-num">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ d }: { d: PlayerDetail }) {
  const g = d.grade;
  const gradeClass = g.grade === "A" ? "keep" : g.grade === "B" ? "hold" : "cut";
  return (
    <>
      <div className="modal-head">
        <div>
          <h3 style={{ margin: 0, textTransform: "none", color: "var(--text)", fontSize: 18 }}>{d.name}</h3>
          <div className="dim" style={{ fontSize: 13 }}>
            <span className={"pos pos-" + d.position}>{d.position}</span> {d.nflTeam ?? "FA"} ·{" "}
            {d.rostered ? `${d.teamName}${d.keeperCost == null ? "" : ` · keep ${money(d.keeperCost)}`}` : "free agent"}
          </div>
        </div>
        <div className="grade-badge">
          <span className={"badge " + gradeClass} style={{ fontSize: 20, padding: "6px 14px" }}>
            {g.grade}
          </span>
          <div className="dim" style={{ fontSize: 11, marginTop: 4, textAlign: "center" }}>consistency</div>
        </div>
      </div>

      <div className="arch-line">
        <strong style={{ textTransform: "capitalize" }}>{g.archetype.replace("-", " ")}</strong> — {ARCHETYPE_BLURB[g.archetype]}
      </div>

      <div className="stat-chips">
        <span><b>{g.total}</b> total</span>
        <span><b>{g.ppg}</b> ppg</span>
        <span><b>{g.median}</b> median</span>
        <span><b>{g.games}</b> games</span>
        <span><b>{g.best}</b> best</span>
        <span><b>{g.worst}</b> worst</span>
        <span className="num pos"><b>{g.boomCount}</b> boom</span>
        <span className="num neg"><b>{g.bustCount}</b> bust</span>
      </div>

      <h4 className="dim" style={{ margin: "14px 0 4px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {d.season} week by week
      </h4>
      <WeekBars weekly={d.weekly} boomLine={g.boomLine} bustLine={g.bustLine} />
      <div className="legend">
        Bars: <span className="num pos">boom</span> (≥{g.boomLine}) · <span className="wk-mid-key">solid</span> = a
        startable week · <span className="num neg">bust</span> (≤{g.bustLine}), by {d.position} scoring. Grade is off
        the <strong>median</strong> week, so one huge game can't fake it.
      </div>
    </>
  );
}

export function PlayerModal() {
  const id = useOpenPlayer();
  const details = useAsync(() => api.playerDetails(), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && closePlayer();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  if (!id) return null;
  const d = details.data?.[id];
  return (
    <div className="modal-backdrop" onClick={closePlayer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={closePlayer} aria-label="Close">
          ✕
        </button>
        {details.loading ? (
          <p className="dim">Loading…</p>
        ) : d ? (
          <Detail d={d} />
        ) : (
          <p className="notice">No last-season game log for this player (e.g. a rookie or deep free agent).</p>
        )}
      </div>
    </div>
  );
}
