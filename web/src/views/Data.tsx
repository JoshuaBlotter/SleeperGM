import { useMemo, useState } from "react";
import { api, type PlayerRow } from "../api";
import { ErrorBox, Loading, money, useAsync } from "../ui";

type SortKey = "name" | "yearsInLeague" | "lastSeasonPoints" | "baseCost" | "keeperCostNextYear";

// null numbers sort to the bottom regardless of direction.
function numOf(v: number | null | undefined, asc: boolean): number {
  if (v == null) return asc ? Infinity : -Infinity;
  return v;
}

export function DataView() {
  const s = useAsync(() => api.players(), []);
  const [team, setTeam] = useState("");
  const [nfl, setNfl] = useState("");
  const [pos, setPos] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("lastSeasonPoints");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    let r = s.data?.players ?? [];
    if (team) r = r.filter((p) => p.teamName === team);
    if (nfl) r = r.filter((p) => (p.nflTeam ?? "") === nfl);
    if (pos) r = r.filter((p) => p.position === pos);
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const dir = asc ? 1 : -1;
    return [...r].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      return (numOf(a[sort], asc) - numOf(b[sort], asc)) * dir;
    });
  }, [s.data, team, nfl, pos, q, sort, asc]);

  if (s.loading) return <Loading what="player data" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const all = s.data?.players ?? [];
  const teams = [...new Set(all.map((p) => p.teamName))].sort();
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
    <section>
      <h2>Player Data</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Every rostered player — filter by fantasy team, NFL team, or position; click a column to sort.
      </p>

      <div className="filters">
        <input placeholder="Search player…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">All fantasy teams</option>
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

      <table className="grid">
        <thead>
          <tr>
            <th>Fantasy team</th>
            {th("name", "Player")}
            <th>Pos</th>
            <th>NFL</th>
            {th("lastSeasonPoints", "Last pts", true)}
            {th("yearsInLeague", "In league", true)}
            {th("baseCost", "Base $", true)}
            {th("keeperCostNextYear", "Keep $", true)}
            <th>Src</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p: PlayerRow) => (
            <tr key={`${p.teamId}-${p.playerId}`}>
              <td className="dim">{p.teamName}</td>
              <td className="strong">{p.name}</td>
              <td>
                <span className={"pos pos-" + p.position}>{p.position}</span>
              </td>
              <td className="dim">{p.nflTeam ?? "—"}</td>
              <td className="r">{p.lastSeasonPoints == null ? "—" : p.lastSeasonPoints.toFixed(1)}</td>
              <td className="r">{p.yearsInLeague == null ? "—" : `${p.yearsInLeague} yr${p.yearsInLeague === 1 ? "" : "s"}`}</td>
              <td className="r">{p.costKnown ? money(p.baseCost) : "—"}</td>
              <td className="r">{money(p.keeperCostNextYear)}</td>
              <td>
                {p.salarySource === "sheet" ? (
                  <span className="mark">†</span>
                ) : p.approximate ? (
                  <span className="mark warn">≈</span>
                ) : (
                  <span className="dim">·</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend">
        <span className="mark">†</span> salary from league sheet · <span className="mark warn">≈</span> approximate salary ·
        <span className="dim"> Last pts = total fantasy points last season · In league = seasons rostered (any manager)</span>
      </div>
    </section>
  );
}
