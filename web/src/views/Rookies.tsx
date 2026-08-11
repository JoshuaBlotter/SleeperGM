import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, type RookieBoard, type RookiePick, type RookieProspect } from "../api";
import { Row, RowList } from "../Row";
import { ErrorBox, Loading, money, record, useAsync, useIsDesktop } from "../ui";

type Sub = "prospects" | "picks";
const POS = ["QB", "RB", "WR", "TE"];

/** Compact drops the nested position chip to plain colored text, so four pills fit one row. */
function costCell(cost: Record<string, number>, compact = false) {
  const parts = POS.filter((p) => cost[p] != null);
  if (!parts.length) return <span className="dim">—</span>;
  return (
    <span className={"cost-pills" + (compact ? " is-compact" : "")}>
      {parts.map((p) => (
        <span key={p} className="chip chip-neutral">
          <span className={"pos pos-" + p}>{p}</span> {money(cost[p]!)}
        </span>
      ))}
    </span>
  );
}

function Prospects({ b }: { b: RookieBoard }) {
  const rookies = b.prospects ?? [];
  return (
    <>
      <p className="dim lede">
        The incoming rookie class (Sleeper first-year players), ranked by {b.prospectSource || "value"} — shown
        deeper than the 12 first-round slots so you can eyeball the stretch prospects who might sneak into round 1.
        <span className="dim"> · {rookies.length} shown</span>
      </p>
      {rookies.length === 0 ? (
        <p className="notice">No rookie values available from the {b.prospectSource || "value"} source.</p>
      ) : (
        <RowList>
          {rookies.map((r: RookieProspect) => (
            <Row
              key={r.playerId}
              leading={<span className="row-rank">{r.rank}</span>}
              title={
                <>
                  <span>{r.name}</span>
                  <span className={"pos pos-" + r.position}>{r.position}</span>
                </>
              }
              meta={r.nflTeam ?? "—"}
              metric={money(r.value)}
              metricLabel="worth"
            />
          ))}
        </RowList>
      )}
    </>
  );
}

function PickBoard({ b }: { b: RookieBoard }) {
  const isDesktop = useIsDesktop();
  return (
    <>
      <div className="two-col">
        <div>
          <h3>Pick slots (round {b.rounds === 1 ? "1" : `1–${b.rounds}`})</h3>
          {isDesktop ? (
            <table className="grid">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Owner</th>
                  <th>Slot cost (by position)</th>
                </tr>
              </thead>
              <tbody>
                {b.picks.map((p: RookiePick) => (
                  <tr key={p.overall}>
                    <td className="strong">{p.label}</td>
                    <td>
                      {p.ownerTeam}
                      {p.traded && <span className="dim"> · via {p.viaTeam}</span>}
                    </td>
                    <td>{costCell(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <RowList>
              {b.picks.map((p: RookiePick) => (
                <Row
                  key={p.overall}
                  leading={<span className="chip chip-neutral">{p.label}</span>}
                  title={
                    <>
                      <span>{p.ownerTeam}</span>
                      {p.traded && <span className="dim">via {p.viaTeam}</span>}
                    </>
                  }
                  meta={costCell(p.cost, true)}
                />
              ))}
            </RowList>
          )}
        </div>

        <div>
          <h3>Draft capital by team</h3>
          {isDesktop ? (
            <table className="grid">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Picks</th>
                  <th className="r">Net</th>
                </tr>
              </thead>
              <tbody>
                {b.byTeam.map((t) => (
                  <tr key={t.rosterId}>
                    <td className="strong">{t.teamName}</td>
                    <td className="dim">{t.picks.length ? t.picks.join(", ") : "—"}</td>
                    <td className={"r " + (t.extra > 0 ? "num pos" : t.extra < 0 ? "num neg" : "dim")}>
                      {t.extra > 0 ? `+${t.extra}` : t.extra}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <RowList>
              {b.byTeam.map((t) => (
                <Row
                  key={t.rosterId}
                  title={t.teamName}
                  meta={t.picks.length ? t.picks.join(", ") : "—"}
                  metric={t.extra > 0 ? `+${t.extra}` : String(t.extra)}
                  metricLabel="net"
                  metricRole={t.extra > 0 ? "success" : t.extra < 0 ? "danger" : "muted"}
                />
              ))}
            </RowList>
          )}
        </div>
      </div>

      {/* Still a <details> — it is a reference table you open once, not a list you work in. */}
      <details className="reveal">
        <summary>
          Base order — reverse of 2025 regular-season standings
          <ChevronDown className="row-chev" size={18} strokeWidth={1.5} aria-hidden="true" />
        </summary>
        <table className="grid">
          <thead>
            <tr>
              <th className="r">Slot</th>
              <th>Team</th>
              <th>2025</th>
              <th className="r">Points</th>
            </tr>
          </thead>
          <tbody>
            {b.baseOrder.map((o) => (
              <tr key={o.slot}>
                <td className="r dim">{o.slot}</td>
                <td>{o.teamName}</td>
                <td className="dim">{record(o.wins, o.losses, o.ties)}</td>
                <td className="r dim">{o.pointsFor.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

export function RookiesView() {
  const s = useAsync(() => api.rookies(), []);
  const [sub, setSub] = useState<Sub>("prospects");
  if (s.loading) return <Loading what="rookie draft board" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const b = s.data!;

  return (
    <section>
      <div className="head-row">
        <h2>
          Rookies <span className="dim">· {b.season} · {b.rounds} round{b.rounds === 1 ? "" : "s"}{b.snake ? " · snake" : ""}</span>
        </h2>
        <div className="seg">
          <button className={sub === "prospects" ? "is-on" : ""} onClick={() => setSub("prospects")}>
            Prospects
          </button>
          <button className={sub === "picks" ? "is-on" : ""} onClick={() => setSub("picks")}>
            Pick board
          </button>
        </div>
      </div>

      <div className="notice">
        <strong>Derived order.</strong> Sleeper doesn't publish the {b.season} rookie order, so the base is the{" "}
        <strong>reverse of last season's regular-season standings</strong>; current pick ownership is applied from
        Sleeper's traded-picks.
      </div>

      {sub === "prospects" ? <Prospects b={b} /> : <PickBoard b={b} />}
    </section>
  );
}
