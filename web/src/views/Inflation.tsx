import { api } from "../api";
import { ErrorBox, Loading, Surplus, money, useAsync } from "../ui";

export function InflationView({ source }: { source?: string }) {
  const s = useAsync(() => api.inflation(source), [source]);
  if (s.loading) return <Loading what="inflation" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const d = s.data!;
  const pct = Math.round((d.multiplier - 1) * 100);

  return (
    <section>
      <h2>League Auction Inflation</h2>
      <p className="dim">
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
    </section>
  );
}
