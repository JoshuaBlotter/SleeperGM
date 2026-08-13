import { useEffect, useState } from "react";
import { api, type PlayerDetail, type WeekScore } from "./api";
import { PlayerAvatar } from "./Avatar";
import { SalaryKey, SalaryLadder } from "./Salary";
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
/**
 * Colors a positional finish by whether it was startable in a 12-team league: a top-12 finish is
 * a every-week starter, 13-23 is a flex/bye-week body, 24+ was not on a roster that mattered.
 * Only the rank is colored — the chip stays neutral so a season with three finishes does not
 * read as three status badges.
 */
function rankBand(rank: number): string {
  return rank <= 12 ? "is-elite" : rank <= 23 ? "is-mid" : "is-low";
}

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

/**
 * Salary history (#19) — where the keeper cost came from. The season tab answers "is he any good";
 * this one answers "why does he cost that", which is the question a keeper decision actually turns on.
 */
function SalaryTab({ d }: { d: PlayerDetail }) {
  const rows = d.salaryHistory ?? [];
  if (!rows.length) {
    return (
      <p className="notice">
        {d.rostered
          ? "No salary history — this player's acquisition isn't in the league's Sleeper record."
          : "Free agent — no salary in this league until someone signs him."}
      </p>
    );
  }
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const raise = last.salary - first.salary;
  return (
    <>
      <p className="dim lede">
        {first.season}: {money(first.salary)} → {last.season}: <strong>{money(last.salary)}</strong>
        {rows.length > 1 && <> · {money(raise)} of escalation over {rows.length - 1} offseason{rows.length > 2 ? "s" : ""}</>}
      </p>
      <SalaryLadder rows={rows} />
      <SalaryKey rows={rows} />
    </>
  );
}

function Detail({ d }: { d: PlayerDetail }) {
  const g = d.grade;
  if (!d.weekly.length) {
    return (
      <p className="notice">
        No {d.season} game log for this player — a rookie, or he didn't play a snap that counted in our league.
      </p>
    );
  }
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
              <span className="dim">{f.season}</span>
              {/* Position and rank are one token — the chip's flex gap would read "RB 4". */}
              <span>
                {f.position}
                <span className={"finish-rank " + rankBand(f.rank)}>{f.rank}</span>
              </span>
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
  const [tab, setTab] = useState<"season" | "salary">("season");
  // Opening a different player starts on the season tab again — the sheet is reused, so without
  // this the second player you tap inherits whichever tab the first one was left on.
  useEffect(() => setTab("season"), [id]);
  return (
    <Sheet
      open={!!id}
      onClose={closePlayer}
      labelledBy="player-sheet-title"
      title={d?.name ?? (details.loading ? "Loading…" : "Player")}
      lead={d && <PlayerAvatar playerId={d.playerId} name={d.name} position={d.position} nflTeam={d.nflTeam} />}
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
        <>
          {/* Same `.seg` the view headers use — plain buttons, not an ARIA tablist. A tablist without
              real tabpanels announces a structure that isn't there; `aria-pressed` is the honest one. */}
          <div className="seg sheet-seg">
            <button aria-pressed={tab === "season"} className={tab === "season" ? "is-on" : ""} onClick={() => setTab("season")}>
              {d.season} season
            </button>
            <button aria-pressed={tab === "salary"} className={tab === "salary" ? "is-on" : ""} onClick={() => setTab("salary")}>
              Salary history
            </button>
          </div>
          {tab === "season" ? <Detail d={d} /> : <SalaryTab d={d} />}
        </>
      ) : (
        <p className="notice">Nothing on file for this player — not on a roster, and no game log last season.</p>
      )}
    </Sheet>
  );
}
