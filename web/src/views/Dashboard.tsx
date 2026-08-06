import type { LeagueResp } from "../api";
import { ErrorBox, Loading } from "../ui";

export function Dashboard({
  league,
  onOpenTeam,
}: {
  league: { data?: LeagueResp; error?: string; loading: boolean };
  onOpenTeam: (id: number) => void;
}) {
  if (league.loading) return <Loading what="league" />;
  if (league.error) return <ErrorBox message={league.error} />;
  const d = league.data!;
  return (
    <section>
      <h2>League Dashboard</h2>
      <div className="cards">
        <div className="card">
          <div className="k">Season</div>
          <div className="v">{d.season}</div>
        </div>
        <div className="card">
          <div className="k">Salary cap</div>
          <div className="v">${d.capBudget}</div>
        </div>
        <div className="card">
          <div className="k">Teams</div>
          <div className="v">{d.teams.length}</div>
        </div>
        <div className="card highlight">
          <div className="k">Auction inflation</div>
          <div className="v">×{d.multiplier.toFixed(2)}</div>
        </div>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Manager</th>
            <th>Record</th>
            <th className="r">Players</th>
            <th className="r">Taxi</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.teams.map((t) => (
            <tr key={t.rosterId}>
              <td className="dim">{t.rosterId}</td>
              <td className="strong">{t.teamName}</td>
              <td className="dim">{t.manager}</td>
              <td>
                {t.wins}-{t.losses}
                {t.ties ? `-${t.ties}` : ""}
              </td>
              <td className="r">{t.players}</td>
              <td className="r">{t.taxi}</td>
              <td className="r">
                <button className="link" onClick={() => onOpenTeam(t.rosterId)}>
                  View →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
