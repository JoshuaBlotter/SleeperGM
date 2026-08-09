import { api, type LeagueBrain, type LeagueResp, type TeamProfile } from "../api";
import { ErrorBox, Loading, useAsync } from "../ui";

const ARCH_LABEL: Record<TeamProfile["archetype"], string> = {
  contender: "Contender",
  "win-now": "Win-now",
  balanced: "Balanced",
  retooling: "Retooling",
  rebuilding: "Rebuilding",
};

function ProfileCard({ p, onOpen }: { p: TeamProfile; onOpen: (id: number) => void }) {
  return (
    <button className={`brain-card arch-${p.archetype}`} onClick={() => onOpen(p.rosterId)} title="Open team">
      <div className="brain-card-head">
        <span className="team">{p.teamName}</span>
        <span className={`arch-pill arch-${p.archetype}`}>{ARCH_LABEL[p.archetype]}</span>
      </div>
      <div className="brain-scout">{p.scouting}</div>
      {p.tags.length > 0 && (
        <div className="brain-tags">
          {p.tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="brain-stats">
        <span>
          Idx <b>{p.contenderIndex}</b>
        </span>
        <span>
          Value <b>${p.rosterValue}</b>
        </span>
        <span>
          Keepers <b>${p.keeperSurplus}</b>
        </span>
        <span>
          Trades <b>{p.tradeCount}</b>
        </span>
        <span>
          Picks <b>{p.rookiePicks}</b>
        </span>
      </div>
    </button>
  );
}

function BrainSection({ brain, onOpenTeam }: { brain: { data?: LeagueBrain; error?: string; loading: boolean }; onOpenTeam: (id: number) => void }) {
  if (brain.loading) return <Loading what="league brain" />;
  if (brain.error) return <ErrorBox message={brain.error} />;
  const b = brain.data!;
  return (
    <>
      <div className="head-row">
        <h3>🧠 League Brain — superlatives</h3>
        <span className="dim" style={{ fontSize: 12 }}>
          {b.generatedNote}
        </span>
      </div>
      <div className="deck">
        {b.superlatives.map((s) => (
          <div key={s.id} className="info-card award">
            <h4>
              <span>{s.emoji}</span> {s.title}
            </h4>
            <div className="award-winner">
              {s.teamName} <span className="dim">· {s.stat}</span>
            </div>
            <p>{s.blurb}</p>
          </div>
        ))}
      </div>

      <h3>Team profiles</h3>
      <div className="brain-grid">
        {b.profiles.map((p) => (
          <ProfileCard key={p.rosterId} p={p} onOpen={onOpenTeam} />
        ))}
      </div>
    </>
  );
}

export function Dashboard({
  league,
  source,
  onOpenTeam,
}: {
  league: { data?: LeagueResp; error?: string; loading: boolean };
  source?: string;
  onOpenTeam: (id: number) => void;
}) {
  const brain = useAsync(() => api.brain(source), [source]);
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

      <BrainSection brain={brain} onOpenTeam={onOpenTeam} />

      <h3>Standings & rosters</h3>
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
