import { useEffect, useState } from "react";
import { BarChart3, Home, MoreHorizontal, RefreshCw, Search, Users } from "lucide-react";
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

/** Desktop keeps the full horizontal row; mobile shows the first four plus More. */
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

/** The four thumb-zone destinations. Everything else lives behind More. */
const PRIMARY: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "dashboard", label: "Home", Icon: Home },
  { id: "team", label: "Team", Icon: Users },
  { id: "inflation", label: "Market", Icon: BarChart3 },
  { id: "players", label: "Players", Icon: Search },
];
const MORE: { id: Tab; label: string }[] = [
  { id: "tiers", label: "Tiers" },
  { id: "trades", label: "Trades" },
  { id: "rookies", label: "Rookies" },
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
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    api.staticMode().then(setIsStatic);
  }, []);
  const teams = league.data?.teams ?? [];
  const sources = league.data?.sources ?? [];
  const activeSource = source || league.data?.valueSource || "";
  const updated = fmtUpdated(league.data?.updatedAt);
  const showTeamPicker = tab === "team" || tab === "trades";

  function go(next: Tab) {
    setTab(next);
    setMoreOpen(false);
  }
  function openTeam(id: number) {
    setTeamId(id);
    go("team");
  }
  async function refresh() {
    setRefreshing(true);
    await api.refresh();
    location.reload();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-name">Sleeper GM</span>
          <span className="wordmark-sub">
            Los Socios · {league.data?.season ?? "…"} · ×{league.data?.multiplier?.toFixed(2) ?? "…"}
          </span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "is-on" : ""} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="controls">
          {isStatic ? (
            <span className="updated" title="This is a static snapshot; data refreshes when the nightly build runs.">
              updated {updated || "—"}
            </span>
          ) : (
            <button
              className="btn btn-icon"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh"
              title="Clear the server cache and reload with fresh Sleeper data"
            >
              <RefreshCw size={20} strokeWidth={1.5} className={refreshing ? "spin" : ""} />
            </button>
          )}
        </div>
      </header>

      {/* Context strip — only the controls that change WHAT you are looking at. */}
      <div className="ctx">
        {showTeamPicker && (
          <select
            className="ctx-control"
            value={teamId ?? ""}
            onChange={(e) => setTeamId(Number(e.target.value))}
            aria-label="Team"
          >
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
        {sources.length > 1 ? (
          <select
            className="ctx-control"
            value={activeSource}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Player value source"
          >
            {sources.map((src) => (
              <option key={src} value={src}>
                values: {src}
              </option>
            ))}
          </select>
        ) : (
          <span className="ctx-meta">values: {activeSource || "…"}</span>
        )}
      </div>

      <main>
        {tab === "dashboard" && <Dashboard league={league} source={activeSource || undefined} onOpenTeam={openTeam} />}
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

      {moreOpen && <div className="more-scrim" onClick={() => setMoreOpen(false)} />}
      {moreOpen && (
        <div className="more-menu" role="menu" aria-label="More sections">
          {MORE.map((t) => (
            <button key={t.id} role="menuitem" className={tab === t.id ? "is-on" : ""} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <nav className="tabbar" aria-label="Sections">
        {PRIMARY.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? "is-on" : ""} onClick={() => go(id)} aria-current={tab === id}>
            <span className="tabbar-icon">
              <Icon size={22} strokeWidth={1.5} />
            </span>
            {label}
          </button>
        ))}
        <button
          className={MORE.some((m) => m.id === tab) || moreOpen ? "is-on" : ""}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
        >
          <span className="tabbar-icon">
            <MoreHorizontal size={22} strokeWidth={1.5} />
          </span>
          More
        </button>
      </nav>
    </div>
  );
}
