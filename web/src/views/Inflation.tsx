import { useMemo, useState } from "react";
import { api, type DraftValueRow, type PositionScarcity } from "../api";
import { ErrorBox, Loading, Surplus, money, signed, useAsync } from "../ui";

type Sub = "overview" | "auction" | "scarcity";

function scarcityBand(score: number): string {
  return score >= 0.66 ? "hot" : score >= 0.4 ? "warm" : "cool";
}

function Scarcity({ source }: { source?: string }) {
  const s = useAsync(() => api.scarcity(source), [source]);
  if (s.loading) return <Loading what="positional scarcity" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const positions = s.data ?? [];
  return (
    <>
      <p className="dim" style={{ marginTop: 0 }}>
        How much of each position's top tier is a projected <strong>keeper</strong> (off the auction board). Higher =
        scarcer = expect a price run. "kept" = worth ≥ keeper cost (a rational keeper); overpriced roster players
        count as likely cuts, so this firms up as managers actually lock their keepers.
      </p>
      <div className="deck">
        {positions.map((pos: PositionScarcity) => (
          <div className="info-card" key={pos.position}>
            <h4>
              <span className={"pos pos-" + pos.position}>{pos.position}</span>
              <span className="dim push">{Math.round(pos.scarcityScore * 100)}% scarce</span>
            </h4>
            <div className="scar-bar">
              <div className={"scar-fill " + scarcityBand(pos.scarcityScore)} style={{ width: `${pos.scarcityScore * 100}%` }} />
            </div>
            <p>
              <strong>{pos.keptCount}</strong> of top {pos.topN} kept · <strong>{pos.availableCount}</strong> available.
              <br />
              Best available:{" "}
              {pos.bestAvailable ? (
                <span className="strong">
                  {pos.bestAvailable.name} <span className="dim">({money(pos.bestAvailable.value)})</span>
                </span>
              ) : (
                "—"
              )}
            </p>
            <details className="reveal">
              <summary>top {pos.topN} by value</summary>
              <div style={{ marginTop: 6 }}>
                {pos.players.map((p) => (
                  <div className="scar-row" key={p.playerId}>
                    <span className={p.kept ? "dim" : "strong"}>{p.name}</span>
                    <span className="r">{money(p.value)}</span>
                    <span>{p.kept ? <span className="dim">kept</span> : <span className="chip chip-solid chip-success">open</span>}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </>
  );
}

function Overview({ source }: { source?: string }) {
  const s = useAsync(() => api.inflation(source), [source]);
  if (s.loading) return <Loading what="inflation" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const pct = Math.round((d.multiplier - 1) * 100);
  return (
    <>
      <p className="dim" style={{ marginTop: 0 }}>
        Cheap keepers leave surplus cap in the economy, chasing a smaller pool of available players. Kickers &amp;
        defenses excluded (streamed for ~$0).
      </p>
      <div className="cards">
        <div className="card">
          <div className="k">Keeper surplus</div>
          <div className="v">{money(d.keeperSurplus)}</div>
          <div className="k">extra $ pushed into the draft</div>
        </div>
        <div className="card">
          <div className="k">Money for auction</div>
          <div className="v">{money(d.auctionMoney)}</div>
        </div>
        <div className="card">
          <div className="k">Value for auction</div>
          <div className="v">{money(d.auctionValue)}</div>
        </div>
        <div className="card highlight big">
          <div className="k">Inflation</div>
          <div className="v">×{d.multiplier.toFixed(2)}</div>
          <div className="k">~{pct}% over face</div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h3>Biggest discounts driving inflation</h3>
          <table className="grid">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Team</th>
                <th className="r">Worth</th>
                <th className="r">Salary</th>
                <th className="r">Surplus</th>
              </tr>
            </thead>
            <tbody>
              {d.topDiscounts.map((p, i) => (
                <tr key={i}>
                  <td className="strong">{p.name}</td>
                  <td>
                    <span className={"pos pos-" + p.position}>{p.position}</span>
                  </td>
                  <td className="dim">{p.teamName}</td>
                  <td className="r">{money(p.worth)}</td>
                  <td className="r">{money(p.salary)}</td>
                  <td className="r">
                    <Surplus value={p.surplus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Surplus by team</h3>
          <table className="grid">
            <thead>
              <tr>
                <th>Team</th>
                <th className="r">Keeps</th>
                <th className="r">Surplus</th>
              </tr>
            </thead>
            <tbody>
              {d.perTeam.map((t) => (
                <tr key={t.teamId}>
                  <td className="strong">{t.teamName}</td>
                  <td className="r">{t.keptCount}</td>
                  <td className="r">
                    <Surplus value={t.surplus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function LastYearAuction({ source }: { source?: string }) {
  const s = useAsync(() => api.draftValue(source), [source]);
  const [pos, setPos] = useState("");
  const [sort, setSort] = useState<"cost" | "gap">("cost");

  const rows = useMemo(() => {
    let r = s.data?.rows ?? [];
    if (pos) r = r.filter((x) => x.position === pos);
    return [...r].sort((a, b) => (sort === "gap" ? a.delta - b.delta : b.cost - a.cost));
  }, [s.data, pos, sort]);

  if (s.loading) return <Loading what="last year's auction" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const net = d.totalWorth - d.totalCost;

  return (
    <>
      <p className="dim" style={{ marginTop: 0 }}>
        What last season's ({d.auctionSeason}) <strong>auction buys</strong> cost, vs their {d.projectionSeason}{" "}
        projected worth. Carried keepers and rookie picks are excluded — this is only what actually went to auction.
      </p>
      <div className="cards">
        <div className="card">
          <div className="k">{d.auctionSeason} auction spend</div>
          <div className="v">{money(d.totalCost)}</div>
          <div className="k">{d.rows.length} players</div>
        </div>
        <div className="card">
          <div className="k">{d.projectionSeason} projected worth</div>
          <div className="v">{money(d.totalWorth)}</div>
        </div>
        <div className={"card " + (net >= 0 ? "good" : "bad")}>
          <div className="k">Net vs last year</div>
          <div className="v">{signed(net)}</div>
          <div className="k">{net >= 0 ? "projecting higher" : "projecting lower"}</div>
        </div>
      </div>

      <div className="filters">
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          <option value="">All positions</option>
          {["QB", "RB", "WR", "TE", "K", "DEF"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="seg">
          <button className={sort === "cost" ? "is-on" : ""} onClick={() => setSort("cost")}>
            Priciest
          </button>
          <button className={sort === "gap" ? "is-on" : ""} onClick={() => setSort("gap")}>
            Biggest drop
          </button>
        </div>
        <span className="dim">{rows.length} players</span>
      </div>

      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th className="r">{d.auctionSeason} cost</th>
              <th className="r">{d.projectionSeason} worth</th>
              <th className="r">Δ</th>
              <th>Now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: DraftValueRow) => (
              <tr key={p.playerId}>
                <td className="strong">{p.name}</td>
                <td>
                  <span className={"pos pos-" + p.position}>{p.position}</span>
                </td>
                <td className="r">{money(p.cost)}</td>
                <td className="r">{money(p.worth)}</td>
                <td className="r">
                  <span className={"num " + (p.delta > 0 ? "pos" : p.delta < 0 ? "neg" : "zero")}>
                    {signed(p.delta)}
                    {p.deltaPct == null ? "" : ` (${p.deltaPct > 0 ? "+" : ""}${p.deltaPct}%)`}
                  </span>
                </td>
                <td>
                  {p.kept ? (
                    <span className="dim">
                      kept {p.keeperCost == null ? "" : money(p.keeperCost)} · {p.ownerTeam}
                    </span>
                  ) : (
                    <span className="chip chip-solid chip-warning">pool</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        Δ = {d.projectionSeason} projected worth − {d.auctionSeason} auction cost. <span className="num neg">Red</span>{" "}
        = we project them lower than last year's price (don't chase it); <span className="num pos">green</span> = value
        has risen. "kept" players aren't back in the auction pool.
      </div>
    </>
  );
}

export function InflationView({ source }: { source?: string }) {
  const [sub, setSub] = useState<Sub>("overview");
  return (
    <section>
      <div className="head-row">
        <h2>Market</h2>
        <div className="seg">
          <button className={sub === "overview" ? "is-on" : ""} onClick={() => setSub("overview")}>
            Inflation
          </button>
          <button className={sub === "scarcity" ? "is-on" : ""} onClick={() => setSub("scarcity")}>
            Scarcity
          </button>
          <button className={sub === "auction" ? "is-on" : ""} onClick={() => setSub("auction")}>
            Last-year auction
          </button>
        </div>
      </div>
      {sub === "overview" ? <Overview source={source} /> : sub === "scarcity" ? <Scarcity source={source} /> : <LastYearAuction source={source} />}
    </section>
  );
}
