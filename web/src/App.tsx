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
  const league = useAsync(() => api.league(), []);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const teams = league.data?.teams ?? [];

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
              Los Socios · {league.data?.season ?? "…"} · inflation ×{league.data?.multiplier?.toFixed(2) ?? "…"}
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
          <button className="refresh" onClick={refresh} disabled={refreshing}>
            {refreshing ? "…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      <main>
        {tab === "dashboard" && <Dashboard league={league} onOpenTeam={openTeam} />}
        {tab === "team" && <TeamView teamId={teamId} />}
        {tab === "inflation" && <InflationView />}
        {tab === "trades" && <TradesView teamId={teamId} teams={teams} />}
        {tab === "data" && <DataView />}
        {tab === "rules" && <RulesView />}
      </main>

      <footer>
        Read-only · data from the Sleeper API + league salary sheet · keeper rules per <code>league-rules.ts</code>
      </footer>
    </div>
  );
}
