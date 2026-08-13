import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, type DraftValueRow, type PositionScarcity, type ScarcityPlayer } from "../api";
import { Row, RowList } from "../Row";
import { ErrorBox, Loading, Surplus, money, signed, useAsync, useIsDesktop } from "../ui";

type Sub = "overview" | "auction" | "scarcity";

function scarcityBand(score: number): string {
  return score >= 0.66 ? "hot" : score >= 0.4 ? "warm" : "cool";
}

/** Colors a trailing metric that can go either way. */
function sign(n: number): "success" | "danger" | "muted" {
  return n > 0 ? "success" : n < 0 ? "danger" : "muted";
}

function ScarcityCard({ pos }: { pos: PositionScarcity }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="info-card">
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
      {/* The old <details> reveal: same disclosure, but at 44px with the row chevron. */}
      <button className="card-expander" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        top {pos.topN} on the board
        <ChevronDown className="row-chev" size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        <div className="card-rows">
          {pos.players.map((p: ScarcityPlayer) => (
            <Row
              key={p.playerId}
              title={p.name}
              meta={p.kept ? <span className="chip chip-neutral">kept</span> : <span className="chip chip-solid chip-success">open</span>}
              metric={money(p.value)}
              metricLabel="worth"
              metricRole={p.kept ? "muted" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Scarcity({ source }: { source?: string }) {
  const s = useAsync(() => api.scarcity(source), [source]);
  if (s.loading) return <Loading what="positional scarcity" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const positions = s.data ?? [];
  return (
    <>
      <p className="dim lede">
        How much of each position's top tier is a projected <strong>keeper</strong> (off the auction board). Higher =
        scarcer = expect a price run. "kept" = worth ≥ keeper cost (a rational keeper); overpriced roster players
        count as likely cuts, so this firms up as managers actually lock their keepers. The tier is
        <strong> {source ?? "the value source"}</strong>'s own top 12 — a player it doesn't rank is off the board, not
        slotted in on last season's points.
      </p>
      <div className="deck">
        {positions.map((pos: PositionScarcity) => (
          <ScarcityCard key={pos.position} pos={pos} />
        ))}
      </div>
    </>
  );
}

function Overview({ source }: { source?: string }) {
  const s = useAsync(() => api.inflation(source), [source]);
  const isDesktop = useIsDesktop();
  if (s.loading) return <Loading what="inflation" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const pct = Math.round((d.multiplier - 1) * 100);
  return (
    <>
      <p className="dim lede">
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
          {isDesktop ? (
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
          ) : (
            <RowList>
              {d.topDiscounts.map((p, i) => (
                <Row
                  key={i}
                  title={
                    <>
                      <span>{p.name}</span>
                      <span className={"pos pos-" + p.position}>{p.position}</span>
                    </>
                  }
                  meta={p.teamName}
                  metric={signed(p.surplus)}
                  metricLabel="surplus"
                  metricRole={sign(p.surplus)}
                  details={[
                    { k: "worth", v: money(p.worth) },
                    { k: "salary", v: money(p.salary) },
                  ]}
                />
              ))}
            </RowList>
          )}
        </div>
        <div>
          <h3>Surplus by team</h3>
          {isDesktop ? (
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
          ) : (
            <RowList>
              {d.perTeam.map((t) => (
                <Row
                  key={t.teamId}
                  title={t.teamName}
                  meta={`${t.keptCount} keep${t.keptCount === 1 ? "" : "s"}`}
                  metric={signed(t.surplus)}
                  metricLabel="surplus"
                  metricRole={sign(t.surplus)}
                />
              ))}
            </RowList>
          )}
        </div>
      </div>
    </>
  );
}

function LastYearAuction({ source }: { source?: string }) {
  const s = useAsync(() => api.draftValue(source), [source]);
  const [pos, setPos] = useState("");
  const [sort, setSort] = useState<"cost" | "gap">("cost");
  const isDesktop = useIsDesktop();

  const rows = useMemo(() => {
    let r = s.data?.rows ?? [];
    if (pos) r = r.filter((x) => x.position === pos);
    return [...r].sort((a, b) => (sort === "gap" ? a.delta - b.delta : b.cost - a.cost));
  }, [s.data, pos, sort]);

  if (s.loading) return <Loading what="last year's auction" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const net = d.totalMarketWorth - d.totalCost;
  const flaggedCount = d.rows.filter((r) => r.flagged).length;
  // Δ and its percentage are one value, so they ride together on the metric line.
  const delta = (p: DraftValueRow) =>
    signed(p.delta) + (p.deltaPct == null ? "" : ` (${p.deltaPct > 0 ? "+" : ""}${p.deltaPct}%)`);
  const now = (p: DraftValueRow) =>
    p.kept ? (
      <span className="dim">
        kept {p.keeperCost == null ? "" : money(p.keeperCost)} · {p.ownerTeam}
      </span>
    ) : (
      <span className="chip chip-solid chip-warning">pool</span>
    );

  return (
    <>
      <p className="dim lede">
        What last season's ({d.auctionSeason}) <strong>auction buys</strong> cost, vs what we expect them to cost in{" "}
        {d.projectionSeason} — face worth inflated ×{d.multiplier.toFixed(2)}, so both numbers are auction dollars.
        Carried keepers and rookie picks never went to auction, so they are not here (that is why a long-held keeper
        can be missing while a $1 flier is not).
      </p>
      <div className="cards">
        <div className="card">
          <div className="k">{d.auctionSeason} auction spend</div>
          <div className="v">{money(d.totalCost)}</div>
          <div className="k">{d.rows.length} players</div>
        </div>
        <div className="card">
          <div className="k">{d.projectionSeason} expected cost</div>
          <div className="v">{money(d.totalMarketWorth)}</div>
          <div className="k">{money(d.totalWorth)} face × {d.multiplier.toFixed(2)}</div>
        </div>
        <div className={"card " + (net >= 0 ? "good" : "bad")}>
          <div className="k">Net vs last year</div>
          <div className="v">{signed(net)}</div>
          <div className="k">{net >= 0 ? "market up" : "market down"}</div>
        </div>
      </div>

      {flaggedCount > 0 && (
        <div className="notice">
          <strong>{flaggedCount} price{flaggedCount === 1 ? "" : "s"} moved a long way.</strong> Buys of{" "}
          {money(10)}+ whose expected cost is 40%+ off what was paid carry a <span className="chip chip-solid chip-warning">check</span>{" "}
          mark. A real change in outlook looks like this — so does a value the source has plain wrong. Worth a look
          before you trust it, and an override on the Team page if it is wrong.
        </div>
      )}

      <div className="toolbar">
        <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
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

      {isDesktop ? (
        <div className="table-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="r">{d.auctionSeason} cost</th>
                <th className="r" title={`Face worth × ${d.multiplier.toFixed(2)} inflation`}>
                  {d.projectionSeason} expected
                </th>
                <th className="r">Δ</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p: DraftValueRow) => (
                <tr key={p.playerId}>
                  <td className="strong">
                    {p.name} {p.flagged && <span className="chip chip-solid chip-warning">check</span>}
                  </td>
                  <td>
                    <span className={"pos pos-" + p.position}>{p.position}</span>
                  </td>
                  <td className="r">{money(p.cost)}</td>
                  <td className="r" title={`${money(p.worth)} face`}>
                    {money(p.marketWorth)}
                  </td>
                  <td className="r">
                    <span className={"num " + (p.delta > 0 ? "pos" : p.delta < 0 ? "neg" : "zero")}>{delta(p)}</span>
                  </td>
                  <td>{now(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <RowList>
          {rows.map((p: DraftValueRow) => (
            <Row
              key={p.playerId}
              title={
                <>
                  <span>{p.name}</span>
                  <span className={"pos pos-" + p.position}>{p.position}</span>
                  {p.flagged && <span className="chip chip-solid chip-warning">check</span>}
                </>
              }
              meta={now(p)}
              metric={delta(p)}
              metricLabel="Δ"
              metricRole={sign(p.delta)}
              details={[
                { k: `${d.auctionSeason} cost`, v: money(p.cost) },
                { k: `${d.projectionSeason} expected`, v: money(p.marketWorth) },
                { k: "face worth", v: money(p.worth) },
                { k: "inflation", v: `×${d.multiplier.toFixed(2)}` },
              ]}
            />
          ))}
        </RowList>
      )}
      <div className="legend">
        Δ = {d.projectionSeason} expected cost − {d.auctionSeason} auction cost, both in auction dollars.{" "}
        <span className="num neg">Red</span> = the market has come down on them (don't chase last year's price);{" "}
        <span className="num pos">green</span> = it has moved up. "kept" players aren't back in the auction pool.
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
