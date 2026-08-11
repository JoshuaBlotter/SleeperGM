import { useState } from "react";
import { api, type PlayerDetail, type WeekScore } from "./api";
import { Sheet } from "./Sheet";
import { money, useAsync } from "./ui";
import { closePlayer, useOpenPlayer } from "./playerModalStore";

const ARCHETYPE_BLURB: Record<string, string> = {
  "league-winner": "Elite floor AND ceiling — boomed most weeks. The guys you build around.",
  consistent: "Steady week to week — you knew what you'd get.",
  steady: "Fairly reliable with some week-to-week swing.",
  "boom-bust": "High variance — real ceiling weeks and duds in equal measure.",
  "one-week-wonder": "One big week carried the season total; otherwise thin.",
  bust: "Never really hit — mostly dud weeks, no boom games. Fade.",
  "late-riser": "Didn't play until midseason — a call-up or breakout. Small, recent sample.",
  "injury-limited": "Played few games despite an early start — likely lost time to injury.",
};

/** Bar height is data, not design — set as a property so the file carries no inline style objects. */
const barHeight = (pct: number) => (el: HTMLDivElement | null) => {
  el?.style.setProperty("height", `${pct}%`);
};

/**
 * Weekly game log. Pointing at a week reads its score out above the chart rather than into a
 * floating bubble: a bubble anchored to a 16px bar needs edge-clamping inside a scrolling sheet,
 * and on a phone your finger covers it. The readout is also the only version of this that works
 * on touch at all — the `title` tooltip it replaces never fired there.
 */
function WeekBars({
  weekly,
  boomLine,
  bustLine,
  season,
}: {
  weekly: WeekScore[];
  boomLine: number;
  bustLine: number;
  season: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!weekly.length) return null;
  const max = Math.max(1, ...weekly.map((w) => w.points));
  const first = weekly[0]!.week;
  const last = weekly[weekly.length - 1]!.week;
  const byWeek = new Map(weekly.map((w) => [w.week, w.points]));
  // Render the full week span so mid-season gaps (missed weeks) show as blanks with real week numbers.
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const clear = (week: number) => setActive((a) => (a === week ? null : a));
  const readout = (week: number) => {
    const pts = byWeek.get(week);
    return pts === undefined ? "did not play" : `${pts} pts`;
  };

  return (
    <>
      <div className="chart-head">
        <h3>{season} week by week</h3>
        <span className="wk-readout" aria-live="polite">
          {active == null ? (
            <span className="dim">tap a week for its score</span>
          ) : (
            <>
              Wk {active} · {readout(active)}
            </>
          )}
        </span>
      </div>
      <div className={"wk-chart" + (active != null ? " has-active" : "")}>
        {span.map((week, i) => {
          const pts = byWeek.get(week);
          // Every third week only — at 11px the full run collides below about 12 columns.
          const label = i % 3 === 0 ? week : "";
          const band = pts === undefined ? "gap" : pts >= boomLine ? "boom" : pts <= bustLine ? "bust" : "mid";
          return (
            <button
              type="button"
              key={week}
              className={"wk-col" + (active === week ? " is-active" : "")}
              // Hover for a mouse, tap for a finger, focus for a keyboard — same readout.
              onMouseEnter={() => setActive(week)}
              onMouseLeave={() => clear(week)}
              onFocus={() => setActive(week)}
              onBlur={() => clear(week)}
              onClick={() => setActive((a) => (a === week ? null : week))}
              aria-label={`Week ${week}: ${readout(week)}`}
            >
              <div
                className={"wk-bar " + band}
                ref={barHeight(pts === undefined ? 0 : Math.max(3, (pts / max) * 100))}
              />
              <span className="wk-num">{label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Detail({ d }: { d: PlayerDetail }) {
  const g = d.grade;
  const gradeClass = g.grade === "A" ? "keep" : g.grade === "B" ? "hold" : "cut";
  const partial = g.firstWeek > 1 || g.lastWeek - g.firstWeek + 1 > g.games;
  return (
    <>
      {/* Grade and archetype are one judgement, so they read as one banner. */}
      <div className="grade-banner">
        <span className={"grade-mark " + gradeClass} title="consistency grade">
          {g.grade}
        </span>
        <div className="grade-text">
          <div className="grade-arch">{g.archetype.replace("-", " ")}</div>
          <div className="grade-blurb">{ARCHETYPE_BLURB[g.archetype]}</div>
        </div>
      </div>

      {d.finishes.length > 0 && (
        <div className="finish-line">
          <span className="dim">Positional finish:</span>
          {d.finishes.map((f) => (
            <span className="chip chip-neutral" key={f.season} title={`${f.points} pts`}>
              <span className="dim">{f.season}</span> {f.position}
              {f.rank}
            </span>
          ))}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="v">{g.total}</div>
          <div className="k">total</div>
        </div>
        <div className="stat-cell">
          <div className="v">{g.ppg}</div>
          <div className="k">ppg</div>
        </div>
        <div className="stat-cell">
          <div className="v">{g.median}</div>
          <div className="k">median</div>
        </div>
        <div className="stat-cell">
          <div className="v">{g.games}</div>
          <div className="k">games</div>
        </div>
        <div className="stat-cell">
          <div className="v">{g.best}</div>
          <div className="k">best</div>
        </div>
        <div className="stat-cell">
          <div className="v">{g.worst}</div>
          <div className="k">worst</div>
        </div>
        <div className="stat-cell wide good">
          <div className="v">{g.boomCount}</div>
          <div className="k">boom weeks</div>
        </div>
        <div className="stat-cell wide bad">
          <div className="v">{g.bustCount}</div>
          <div className="k">bust weeks</div>
        </div>
      </div>

      <WeekBars weekly={d.weekly} boomLine={g.boomLine} bustLine={g.bustLine} season={d.season} />
      <div className="wk-key">
        <span className="chip chip-solid chip-success">boom ≥ {g.boomLine}</span>
        <span className="chip chip-solid chip-accent">solid — a startable week</span>
        <span className="chip chip-solid chip-danger">bust ≤ {g.bustLine}</span>
      </div>
      <p className="legend">
        Bands are by {d.position} scoring. The grade is off the <strong>median</strong> week, so one huge game can't
        fake it.
        {partial && (
          <>
            {" "}
            Every NFL week is checked, so the gaps are weeks this player <strong>did not play</strong> — bye, injury or
            inactive. Only games actually played count toward the grade (this log runs wk {g.firstWeek}–{g.lastWeek}).
          </>
        )}
      </p>
    </>
  );
}

export function PlayerModal() {
  const id = useOpenPlayer();
  const details = useAsync(() => api.playerDetails(), []);
  const d = id ? details.data?.[id] : undefined;
  return (
    <Sheet
      open={!!id}
      onClose={closePlayer}
      labelledBy="player-sheet-title"
      title={d?.name ?? (details.loading ? "Loading…" : "Player")}
      meta={
        d && (
          <>
            <span className={"pos pos-" + d.position}>{d.position}</span>
            <span>{d.nflTeam ?? "FA"}</span>
            <span>
              ·{" "}
              {d.rostered
                ? `${d.teamName}${d.keeperCost == null ? "" : ` · keep ${money(d.keeperCost)}`}`
                : "free agent"}
            </span>
          </>
        )
      }
    >
      {details.loading ? (
        <p className="dim">Loading…</p>
      ) : d ? (
        <Detail d={d} />
      ) : (
        <p className="notice">No last-season game log for this player (e.g. a rookie or deep free agent).</p>
      )}
    </Sheet>
  );
}
