import { api, type RookiePick } from "../api";
import { ErrorBox, Loading, money, record, useAsync } from "../ui";

const POS = ["QB", "RB", "WR", "TE"];

function costCell(cost: Record<string, number>) {
  const parts = POS.filter((p) => cost[p] != null);
  if (!parts.length) return <span className="dim">—</span>;
  return (
    <span className="cost-pills">
      {parts.map((p) => (
        <span key={p} className="cost-pill">
          <span className={"pos pos-" + p}>{p}</span> {money(cost[p]!)}
        </span>
      ))}
    </span>
  );
}

export function RookiesView() {
  const s = useAsync(() => api.rookies(), []);
  if (s.loading) return <Loading what="rookie draft board" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const b = s.data!;
  const rookies = b.prospects ?? [];

  return (
    <section>
      <div className="head-row">
        <h2>
          Rookie Draft Board <span className="dim">· {b.season} · {b.rounds} round{b.rounds === 1 ? "" : "s"}{b.snake ? " · snake" : ""}</span>
        </h2>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        <strong>Derived order.</strong> Sleeper doesn't publish the {b.season} rookie order, so the base is the{" "}
        <strong>reverse of last season's regular-season standings</strong> (wins, then points-for); current pick
        ownership is applied from Sleeper's traded-picks.
      </div>

      <div className="head-row" style={{ marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>
          Rookie prospects <span className="dim">· ranked by {b.prospectSource || "value"} · {rookies.length} shown</span>
        </h3>
      </div>
      <p className="dim" style={{ marginTop: 0 }}>
        The incoming rookie class (Sleeper first-year players), ranked by draft-market value — shown deeper than the 12
        first-round slots so you can eyeball the stretch prospects who might sneak into round 1.
      </p>
      {rookies.length === 0 ? (
        <p className="notice">No rookie values available from the {b.prospectSource || "value"} source.</p>
      ) : (
        <div className="prospect-grid">
          {rookies.map((r) => (
            <div className="prospect" key={r.playerId}>
              <span className="prospect-rank">{r.rank}</span>
              <span className="prospect-name strong">{r.name}</span>
              <span className={"pos pos-" + r.position}>{r.position}</span>
              <span className="dim">{r.nflTeam ?? "—"}</span>
              <span className="r strong">{money(r.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="two-col" style={{ marginTop: 24 }}>
        <div>
          <h3>Pick slots (round 1)</h3>
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
        </div>

        <div>
          <h3>Draft capital by team</h3>
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

          <h3 style={{ marginTop: 24 }}>Base order (reverse 2025 standings)</h3>
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
        </div>
      </div>
    </section>
  );
}
