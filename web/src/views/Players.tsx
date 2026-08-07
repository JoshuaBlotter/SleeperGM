import { useMemo, useState } from "react";
import { api, type PlayerRow, type TrendingRow } from "../api";
import { ErrorBox, Loading, money, useAsync } from "../ui";

type Sub = "all" | "trending";
type SortKey = "name" | "yearsInLeague" | "lastSeasonPoints" | "keeperCostNextYear";

// null numbers sort to the bottom regardless of direction.
function numOf(v: number | null | undefined, asc: boolean): number {
  if (v == null) return asc ? Infinity : -Infinity;
  return v;
}
const pts = (v: number | null) => (v == null ? "—" : v.toFixed(1));

function AllPlayers() {
  const s = useAsync(() => api.players(), []);
  const [owner, setOwner] = useState("");
  const [nfl, setNfl] = useState("");
  const [pos, setPos] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("lastSeasonPoints");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    let r = s.data ?? [];
    if (owner === "__fa") r = r.filter((p) => !p.rostered);
    else if (owner) r = r.filter((p) => p.teamName === owner);
    if (nfl) r = r.filter((p) => (p.nflTeam ?? "") === nfl);
    if (pos) r = r.filter((p) => p.position === pos);
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const dir = asc ? 1 : -1;
    return [...r].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      return (numOf(a[sort], asc) - numOf(b[sort], asc)) * dir;
    });
  }, [s.data, owner, nfl, pos, q, sort, asc]);

  if (s.loading) return <Loading what="players" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const all = s.data ?? [];
  const teams = [...new Set(all.filter((p) => p.teamName).map((p) => p.teamName as string))].sort();
  const nflTeams = [...new Set(all.map((p) => p.nflTeam).filter(Boolean) as string[])].sort();

  const th = (key: SortKey, label: string, right = false) => (
    <th
      className={(right ? "r " : "") + "sortable" + (sort === key ? " sorted" : "")}
      onClick={() => (sort === key ? setAsc(!asc) : (setSort(key), setAsc(false)))}
    >
      {label}
      {sort === key ? (asc ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <>
      <div className="filters">
        <input placeholder="Search player…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          <option value="__fa">Free agents</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={nfl} onChange={(e) => setNfl(e.target.value)}>
          <option value="">All NFL teams</option>
          {nflTeams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          <option value="">All positions</option>
          {["QB", "RB", "WR", "TE", "K", "DEF"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="dim">{rows.length} players</span>
      </div>

      <div className="table-scroll">
      <table className="grid">
        <thead>
          <tr>
            {th("name", "Player")}
            <th>Pos</th>
            <th>NFL</th>
            <th>Owner</th>
            {th("lastSeasonPoints", "Last pts", true)}
            {th("yearsInLeague", "In league", true)}
            {th("keeperCostNextYear", "Keep $", true)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p: PlayerRow) => (
            <tr key={`${p.teamId ?? "fa"}-${p.playerId}`}>
              <td className="strong">{p.name}</td>
              <td>
                <span className={"pos pos-" + p.position}>{p.position}</span>
              </td>
              <td className="dim">{p.nflTeam ?? "—"}</td>
              <td className={p.rostered ? "dim" : ""}>
                {p.rostered ? p.teamName : <span className="badge hold">FA</span>}
              </td>
              <td className="r">{pts(p.lastSeasonPoints)}</td>
              <td className="r">{p.yearsInLeague == null ? "—" : `${p.yearsInLeague} yr${p.yearsInLeague === 1 ? "" : "s"}`}</td>
              <td className="r">{p.keeperCostNextYear == null ? "—" : money(p.keeperCostNextYear)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="legend">
        Free agents (<span className="badge hold">FA</span>) are unrostered but fantasy-relevant (in the ADP list or
        50+ points last season). Keep $ / In league apply to rostered players only.
      </div>
    </>
  );
}

function Trending() {
  const s = useAsync(() => api.trending(), []);
  if (s.loading) return <Loading what="trending players" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const rows = s.data ?? [];
  return (
    <>
      <p className="dim" style={{ marginTop: 0 }}>
        Most-added players across Sleeper in the last 24 hours (waiver/pickup buzz).
      </p>
      <div className="table-scroll">
      <table className="grid">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>NFL</th>
            <th className="r">Adds</th>
            <th>Owner</th>
            <th className="r">Last pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p: TrendingRow) => (
            <tr key={p.playerId}>
              <td className="strong">{p.name}</td>
              <td>
                <span className={"pos pos-" + p.position}>{p.position}</span>
              </td>
              <td className="dim">{p.nflTeam ?? "—"}</td>
              <td className="r strong">{p.count.toLocaleString()}</td>
              <td className={p.rostered ? "dim" : ""}>
                {p.rostered ? p.teamName : <span className="badge hold">FA</span>}
              </td>
              <td className="r">{pts(p.lastSeasonPoints)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export function PlayersView() {
  const [sub, setSub] = useState<Sub>("all");
  return (
    <section>
      <div className="head-row">
        <h2>Players</h2>
        <div className="subtabs">
          <button className={sub === "all" ? "active" : ""} onClick={() => setSub("all")}>
            All players
          </button>
          <button className={sub === "trending" ? "active" : ""} onClick={() => setSub("trending")}>
            Trending
          </button>
        </div>
      </div>
      {sub === "all" ? <AllPlayers /> : <Trending />}
    </section>
  );
}
