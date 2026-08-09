import { useEffect, useState } from "react";
import { api } from "./api";
import { useAsync } from "./ui";
import { Dashboard } from "./views/Dashboard";
import { TeamView } from "./views/Team";
import { InflationView } from "./views/Inflation";
import { TradesView } from "./views/Trades";
import { RulesView } from "./views/Rules";
import { PlayersView } from "./views/Players";
import { RookiesView } from "./views/Rookies";
import { TiersView } from "./views/Tiers";
import { PlayerModal } from "./PlayerModal";

type Tab = "dashboard" | "team" | "inflation" | "trades" | "tiers" | "rookies" | "rules" | "players";
const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "team", label: "Team" },
  { id: "inflation", label: "Market" },
  { id: "tiers", label: "Tiers" },
  { id: "trades", label: "Trades" },
  { id: "rookies", label: "Rookies" },
  { id: "players", label: "Players" },
  { id: "rules", label: "Rules" },
];

function fmtUpdated(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function App() {
  const [source, setSource] = useState<string>("");
  const league = useAsync(() => api.league(source || undefined), [source]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isStatic, setIsStatic] = useState(false);
  useEffect(() => {
    api.staticMode().then(setIsStatic);
  }, []);
  const teams = league.data?.teams ?? [];
  const sources = league.data?.sources ?? [];
  const activeSource = source || league.data?.valueSource || "";
  const updated = fmtUpdated(league.data?.updatedAt);

  function openTeam(id: number) {
    setTeamId(id);
    setTab("team");
  }
  async function refresh() {
    setRefreshing(true);
    await api.refresh();
    location.reload();
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">🏈</span>
          <div>
            <h1>Sleeper GM</h1>
            <div className="sub">
              Los Socios · {league.data?.season ?? "…"} · inflation ×{league.data?.multiplier?.toFixed(2) ?? "…"} ·
              values: {league.data?.valueSource ?? "…"}
            </div>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        {/* Mobile: the tab row collapses to a dropdown (see .nav-select in styles.css). */}
        <select className="nav-select" value={tab} onChange={(e) => setTab(e.target.value as Tab)} aria-label="Section">
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="controls">
          {(tab === "team" || tab === "trades") && (
            <select value={teamId ?? ""} onChange={(e) => setTeamId(Number(e.target.value))}>
              <option value="" disabled>
                Pick a team…
              </option>
              {teams.map((t) => (
                <option key={t.rosterId} value={t.rosterId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          )}
          {sources.length > 1 && (
            <select
              value={activeSource}
              onChange={(e) => setSource(e.target.value)}
              title="Player value source"
              aria-label="Player value source"
            >
              {sources.map((src) => (
                <option key={src} value={src}>
                  values: {src}
                </option>
              ))}
            </select>
          )}
          {isStatic ? (
            <span className="updated" title="This is a static snapshot; data refreshes when the nightly build runs.">
              updated {updated || "—"}
            </span>
          ) : (
            <button className="refresh" onClick={refresh} disabled={refreshing} title="Clear the server cache and reload with fresh Sleeper data">
              {refreshing ? "…" : "↻ Refresh"}
            </button>
          )}
        </div>
      </header>

      <main>
        {tab === "dashboard" && <Dashboard league={league} onOpenTeam={openTeam} />}
        {tab === "team" && <TeamView teamId={teamId} source={activeSource || undefined} />}
        {tab === "inflation" && <InflationView source={activeSource || undefined} />}
        {tab === "trades" && <TradesView teamId={teamId} teams={teams} source={activeSource || undefined} />}
        {tab === "tiers" && <TiersView source={activeSource || undefined} />}
        {tab === "rookies" && <RookiesView />}
        {tab === "players" && <PlayersView />}
        {tab === "rules" && <RulesView />}
      </main>

      <PlayerModal />

      <footer>
        Read-only · data from the Sleeper API + league salary sheet · keeper rules per <code>league-rules.ts</code>
      </footer>
    </div>
  );
}
