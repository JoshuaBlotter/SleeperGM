import { useMemo, useState } from "react";
import { api, type PlayerRow } from "../api";
import { Call, ErrorBox, Loading, Surplus, money, useAsync } from "../ui";

type SortKey = "worth" | "keeperCostNextYear" | "surplus" | "yearsKept" | "name";

export function DataView() {
  const s = useAsync(() => api.players(), []);
  const [team, setTeam] = useState("");
  const [pos, setPos] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("surplus");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    let r = s.data?.players ?? [];
    if (team) r = r.filter((p) => p.teamName === team);
    if (pos) r = r.filter((p) => p.position === pos);
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const dir = asc ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [s.data, team, pos, q, sort, asc]);

  if (s.loading) return <Loading what="player data" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const teams = [...new Set((s.data?.players ?? []).map((p) => p.teamName))].sort();

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
      <h2>Player Cost Data</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Every rostered player's raw cost basis, keeper salary, worth and surplus. Click a column to sort.
      </p>

      <div className="filters">
        <input placeholder="Search player…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">All teams</option>
          {teams.map((t) => (
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
            <th>Team</th>
            {th("name", "Player")}
            <th>Pos</th>
            <th>Via</th>
            <th className="r">Season</th>
            <th className="r">Base $</th>
            {th("yearsKept", "Yrs", true)}
            {th("keeperCostNextYear", "Keep $", true)}
            {th("worth", "Worth", true)}
            {th("surplus", "Surplus", true)}
            <th>Call</th>
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
              <td className="dim">
                {p.acquiredVia === "rookie" && p.rookiePick
                  ? `rookie ${p.rookiePick.round}.${String(p.rookiePick.slot).padStart(2, "0")}`
                  : p.acquiredVia}
              </td>
              <td className="r dim">{p.acquisitionSeason ?? "—"}</td>
              <td className="r">{p.costKnown ? money(p.baseCost) : "—"}</td>
              <td className="r">{p.yearsKept}</td>
              <td className="r">{money(p.keeperCostNextYear)}</td>
              <td className="r">{money(p.worth)}</td>
              <td className="r">
                <Surplus value={p.surplus} />
              </td>
              <td>
                <Call rec={p.recommendation} />
              </td>
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
    </section>
  );
}
