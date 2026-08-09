import { useEffect } from "react";
import { api, type PlayerDetail, type WeekScore } from "./api";
import { money, useAsync } from "./ui";
import { closePlayer, useOpenPlayer } from "./playerModalStore";

const ARCHETYPE_BLURB: Record<string, string> = {
  "league-winner": "Elite floor AND ceiling — boomed most weeks. The guys you build around.",
  consistent: "Steady week to week — you knew what you'd get.",
  steady: "Fairly reliable with some week-to-week swing.",
  "boom-bust": "High variance — real ceiling weeks and duds in equal measure.",
  "one-week-wonder": "One big week carried the season total; otherwise thin.",
  bust: "Never really hit — mostly dud weeks, no boom games. Fade.",
  "late-riser": "Only rostered late (a mid-season breakout) — small, recent sample.",
  "injury-limited": "Rostered for few weeks — likely lost time.",
};

function WeekBars({ weekly, boomLine, bustLine }: { weekly: WeekScore[]; boomLine: number; bustLine: number }) {
  if (!weekly.length) return null;
  const max = Math.max(1, ...weekly.map((w) => w.points));
  const first = weekly[0]!.week;
  const last = weekly[weekly.length - 1]!.week;
  const byWeek = new Map(weekly.map((w) => [w.week, w.points]));
  // Render the full week span so mid-season gaps (missed weeks) show as blanks with real week numbers.
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return (
    <div className="wk-chart" role="img" aria-label="weekly fantasy points">
      {span.map((week) => {
        const pts = byWeek.get(week);
        if (pts === undefined) {
          return (
            <div className="wk-col" key={week} title={`Wk ${week}: no data`}>
              <div className="wk-bar gap" style={{ height: "3px" }} />
              <span className="wk-num">{week}</span>
            </div>
          );
        }
        const band = pts >= boomLine ? "boom" : pts <= bustLine ? "bust" : "mid";
        return (
          <div className="wk-col" key={week} title={`Wk ${week}: ${pts}`}>
            <div className={"wk-bar " + band} style={{ height: `${Math.max(3, (pts / max) * 100)}%` }} />
            <span className="wk-num">{week}</span>
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

      {d.finishes.length > 0 && (
        <div className="finish-line">
          <span className="dim">Positional finish:</span>
          {d.finishes.map((f) => (
            <span className="finish-chip" key={f.season} title={`${f.points} pts`}>
              <span className="dim">{f.season}</span> {f.position}
              {f.rank}
            </span>
          ))}
        </div>
      )}

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
        {(g.firstWeek > 1 || g.lastWeek - g.firstWeek + 1 > g.games) && (
          <>
            Only weeks <strong>rostered in the league</strong> are tracked, so earlier NFL weeks may be missing (this
            log is wk {g.firstWeek}–{g.lastWeek}).<br />
          </>
        )}
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
