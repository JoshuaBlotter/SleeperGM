import { useState } from "react";
import { api } from "./api";
import { useAsync } from "./ui";
import { Dashboard } from "./views/Dashboard";
import { TeamView } from "./views/Team";
import { InflationView } from "./views/Inflation";
import { TradesView } from "./views/Trades";
import { RulesView } from "./views/Rules";
import { DataView } from "./views/Data";

type Tab = "dashboard" | "team" | "inflation" | "trades" | "rules" | "data";
const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "team", label: "Team" },
  { id: "inflation", label: "Inflation" },
  { id: "trades", label: "Trades" },
  { id: "data", label: "Data" },
  { id: "rules", label: "Rules" },
];

export function App() {
  const [source, setSource] = useState<string>("");
  const league = useAsync(() => api.league(source || undefined), [source]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const teams = league.data?.teams ?? [];
  const sources = league.data?.sources ?? [];
  const activeSource = source || league.data?.valueSource || "";

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
          <button className="refresh" onClick={refresh} disabled={refreshing}>
            {refreshing ? "…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      <main>
        {tab === "dashboard" && <Dashboard league={league} onOpenTeam={openTeam} />}
        {tab === "team" && <TeamView teamId={teamId} source={activeSource || undefined} />}
        {tab === "inflation" && <InflationView source={activeSource || undefined} />}
        {tab === "trades" && <TradesView teamId={teamId} teams={teams} source={activeSource || undefined} />}
        {tab === "data" && <DataView />}
        {tab === "rules" && <RulesView />}
      </main>

      <footer>
        Read-only · data from the Sleeper API + league salary sheet · keeper rules per <code>league-rules.ts</code>
      </footer>
    </div>
  );
}
