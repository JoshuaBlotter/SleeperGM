import { Brain } from "lucide-react";
import { api, type LeagueBrain, type LeagueResp, type TeamProfile, type TeamRow } from "../api";
import { Row, RowList } from "../Row";
import { ErrorBox, Loading, money, record, useAsync } from "../ui";

const ARCH_LABEL: Record<TeamProfile["archetype"], string> = {
  contender: "Contender",
  "win-now": "Win-now",
  balanced: "Balanced",
  retooling: "Retooling",
  rebuilding: "Rebuilding",
};
const ARCH_CHIP: Record<TeamProfile["archetype"], string> = {
  contender: "chip-solid chip-success",
  "win-now": "chip-solid chip-warning",
  balanced: "chip-neutral",
  retooling: "chip-neutral",
  rebuilding: "chip-solid chip-accent",
};

/**
 * One row per team, carrying what the standings table and the profile card each used to
 * show separately: archetype, record and roster value on the face, the scouting take and
 * the rest of both sources behind the expander. Tapping the name opens the team.
 */
function TeamRowCard({ t, p, onOpen }: { t: TeamRow; p?: TeamProfile; onOpen: (id: number) => void }) {
  const details: { k: string; v: React.ReactNode; wide?: boolean }[] = [];
  if (p) {
    details.push({ k: "scouting", v: p.scouting, wide: true });
    if (p.tags.length)
      details.push({
        k: "tendencies",
        wide: true,
        v: (
          <span className="tag-row">
            {p.tags.map((tag) => (
              <span key={tag} className="chip chip-neutral">
                {tag}
              </span>
            ))}
          </span>
        ),
      });
    details.push({ k: "contender index", v: p.contenderIndex });
    details.push({ k: "keeper surplus", v: money(p.keeperSurplus) });
    details.push({ k: "trades", v: p.tradeCount });
    details.push({ k: "rookie picks", v: p.rookiePicks });
  }
  details.push({ k: "players", v: t.players });
  details.push({ k: "taxi", v: t.taxi });

  return (
    <Row
      leading={<span className="row-rank">{t.rosterId}</span>}
      title={
        <>
          <button className="plink" onClick={() => onOpen(t.rosterId)} title="Open team">
            {t.teamName}
          </button>
          {p && <span className={`chip ${ARCH_CHIP[p.archetype]}`}>{ARCH_LABEL[p.archetype]}</span>}
        </>
      }
      meta={`${record(t.wins, t.losses, t.ties)} · ${t.manager}`}
      metric={p ? money(p.rosterValue) : "—"}
      metricLabel="roster value"
      details={details}
    />
  );
}

function Superlatives({ brain }: { brain: { data?: LeagueBrain; error?: string; loading: boolean } }) {
  if (brain.loading) return <Loading what="league brain" />;
  if (brain.error) return <ErrorBox message={brain.error} />;
  const b = brain.data!;
  return (
    <>
      <div className="head-row">
        <h3 className="h3-icon">
          <Brain size={18} strokeWidth={1.5} /> League Brain — superlatives
        </h3>
        <span className="dim caption">{b.generatedNote}</span>
      </div>
      <div className="deck">
        {b.superlatives.map((s) => (
          <div key={s.id} className="info-card">
            <h4>{s.title}</h4>
            <div className="award-winner">
              {s.teamName} <span className="dim">· {s.stat}</span>
            </div>
            <p>{s.blurb}</p>
          </div>
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
  const profiles = new Map((brain.data?.profiles ?? []).map((p) => [p.rosterId, p] as const));
  return (
    <section>
      <h2>League Dashboard</h2>
      {/* Season and team count live in the context strip; these are the two numbers you act on. */}
      <div className="cards">
        <div className="card">
          <div className="k">Salary cap</div>
          <div className="v">${d.capBudget}</div>
          <div className="k">auction budget</div>
        </div>
        <div className="card highlight big">
          <div className="k">Auction inflation</div>
          <div className="v">×{d.multiplier.toFixed(2)}</div>
        </div>
      </div>

      <Superlatives brain={brain} />

      <h3>Teams</h3>
      <RowList>
        {d.teams.map((t) => (
          <TeamRowCard key={t.rosterId} t={t} p={profiles.get(t.rosterId)} onOpen={onOpenTeam} />
        ))}
      </RowList>
    </section>
  );
}
