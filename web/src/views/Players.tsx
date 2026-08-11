import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { api, type PlayerRow, type TrendingRow } from "../api";
import { Row, RowList } from "../Row";
import { Sheet } from "../Sheet";
import { ErrorBox, Loading, money, useAsync, useIsDesktop } from "../ui";
import { openPlayer } from "../playerModalStore";

type Sub = "all" | "trending";
type SortKey = "name" | "yearsInLeague" | "lastSeasonPoints" | "keeperCostNextYear";
type MetricKey = Exclude<SortKey, "name">;

// null numbers sort to the bottom regardless of direction.
function numOf(v: number | null | undefined, asc: boolean): number {
  if (v == null) return asc ? Infinity : -Infinity;
  return v;
}
const pts = (v: number | null) => (v == null ? "—" : v.toFixed(1));

/**
 * The three numeric columns, as a trailing metric. The row shows whichever one you sorted by.
 * "Rostered" is deliberately not called "in league": in football that means NFL seasons, and
 * this is seasons on a Los Socios roster. NFL experience is its own field now (issue #11).
 */
const METRIC: Record<MetricKey, { label: string; of: (p: PlayerRow) => string }> = {
  lastSeasonPoints: { label: "last pts", of: (p) => pts(p.lastSeasonPoints) },
  yearsInLeague: { label: "rostered", of: (p) => (p.yearsInLeague == null ? "—" : `${p.yearsInLeague}y`) },
  keeperCostNextYear: { label: "keep $", of: (p) => (p.keeperCostNextYear == null ? "—" : money(p.keeperCostNextYear)) },
};
const nflExp = (p: PlayerRow) =>
  p.nflExperience == null ? "—" : p.nflExperience === 0 ? "rookie" : `${p.nflExperience}y`;
const SORTS: { key: SortKey; label: string }[] = [
  { key: "lastSeasonPoints", label: "Last season points" },
  { key: "keeperCostNextYear", label: "Keeper cost" },
  { key: "yearsInLeague", label: "Seasons rostered" },
  { key: "name", label: "Name" },
];

function Owner({ p }: { p: { rostered: boolean; teamName: string | null } }) {
  return p.rostered ? <span>{p.teamName}</span> : <span className="chip chip-solid chip-warning">FA</span>;
}

function AllPlayers() {
  const s = useAsync(() => api.players(), []);
  const [owner, setOwner] = useState("");
  const [nfl, setNfl] = useState("");
  const [pos, setPos] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("lastSeasonPoints");
  const [asc, setAsc] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isDesktop = useIsDesktop();

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

  // Search sits in its own visible field, so only the sheet's controls are counted.
  const activeFilters = [owner, nfl, pos].filter(Boolean).length;
  const clearFilters = () => {
    setOwner("");
    setNfl("");
    setPos("");
  };
  // Sorting by name leaves no number to lead with, so the row falls back to points.
  const metricKey: MetricKey = sort === "name" ? "lastSeasonPoints" : sort;
  const Dir = asc ? ArrowUp : ArrowDown;

  const pick = (key: SortKey) => {
    if (key === sort) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  };

  const th = (key: SortKey, label: string, right = false) => (
    <th
      className={(right ? "r " : "") + "sortable" + (sort === key ? " sorted" : "")}
      onClick={() => (sort === key ? setAsc(!asc) : (setSort(key), setAsc(false)))}
    >
      {label}
      {sort === key && <Dir className="th-dir" size={13} strokeWidth={2} aria-label={asc ? "ascending" : "descending"} />}
    </th>
  );

  const ownerOptions = (
    <>
      <option value="">All owners</option>
      <option value="__fa">Free agents</option>
      {teams.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </>
  );
  const nflOptions = (
    <>
      <option value="">All NFL teams</option>
      {nflTeams.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </>
  );
  const posOptions = (
    <>
      <option value="">All positions</option>
      {["QB", "RB", "WR", "TE", "K", "DEF"].map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </>
  );

  if (isDesktop) {
    return (
      <>
        <div className="filters">
          <input placeholder="Search player…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            {ownerOptions}
          </select>
          <select value={nfl} onChange={(e) => setNfl(e.target.value)} aria-label="NFL team">
            {nflOptions}
          </select>
          <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
            {posOptions}
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
                <th className="r" title="Completed NFL seasons">
                  NFL exp
                </th>
                {th("yearsInLeague", "Rostered", true)}
                {th("keeperCostNextYear", "Keep $", true)}
              </tr>
            </thead>
            <tbody>
              {rows.map((p: PlayerRow) => (
                <tr key={`${p.teamId ?? "fa"}-${p.playerId}`}>
                  <td>
                    <button className="plink" onClick={() => openPlayer(p.playerId)}>
                      {p.name}
                    </button>
                  </td>
                  <td>
                    <span className={"pos pos-" + p.position}>{p.position}</span>
                  </td>
                  <td className="dim">{p.nflTeam ?? "—"}</td>
                  <td className={p.rostered ? "dim" : ""}>
                    <Owner p={p} />
                  </td>
                  <td className="r">{pts(p.lastSeasonPoints)}</td>
                  <td className="r dim">{nflExp(p)}</td>
                  <td className="r">
                    {p.yearsInLeague == null ? "—" : `${p.yearsInLeague} yr${p.yearsInLeague === 1 ? "" : "s"}`}
                  </td>
                  <td className="r">{p.keeperCostNextYear == null ? "—" : money(p.keeperCostNextYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </>
    );
  }

  return (
    <>
      {/* One row of controls, stuck to the top of the list: everything else is in the sheet.
          The status line rides along so the count and the sort never scroll away. */}
      <div className="list-bar">
        <div className="list-bar-row">
          <input placeholder="Search player…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search player" />
          <button
            className="btn btn-secondary"
            onClick={() => setFiltersOpen(true)}
            aria-label={`Filters and sort${activeFilters ? `, ${activeFilters} active` : ""}`}
          >
            <SlidersHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
            Filters
            {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
          </button>
        </div>
        <div className="list-status">
          {rows.length} players · {SORTS.find((o) => o.key === sort)?.label}
          <Dir size={14} strokeWidth={2} aria-label={asc ? "ascending" : "descending"} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="notice">
          No players match. Clear the search{activeFilters > 0 ? " or the filters" : ""} to see the full list.
        </div>
      ) : (
        <RowList>
          {rows.map((p: PlayerRow) => (
            <Row
              key={`${p.teamId ?? "fa"}-${p.playerId}`}
              title={
                <>
                  <button className="plink" onClick={() => openPlayer(p.playerId)}>
                    {p.name}
                  </button>
                  <span className={"pos pos-" + p.position}>{p.position}</span>
                </>
              }
              meta={
                <>
                  <span>{p.nflTeam ?? "—"}</span>
                  <span>·</span>
                  <Owner p={p} />
                </>
              }
              metric={METRIC[metricKey].of(p)}
              metricLabel={METRIC[metricKey].label}
              /* The expander carries the numeric columns the trailing metric is not showing. */
              details={[
                ...(Object.keys(METRIC) as MetricKey[])
                  .filter((k) => k !== metricKey)
                  .map((k) => ({ k: METRIC[k].label, v: METRIC[k].of(p) })),
                { k: "NFL exp", v: nflExp(p) },
              ]}
            />
          ))}
        </RowList>
      )}
      <Legend />

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        meta={`${rows.length} of ${all.length} players`}
        labelledBy="players-filters-title"
      >
        <label className="field">
          <span className="field-k">Owner</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            {ownerOptions}
          </select>
        </label>
        <label className="field">
          <span className="field-k">NFL team</span>
          <select value={nfl} onChange={(e) => setNfl(e.target.value)}>
            {nflOptions}
          </select>
        </label>
        <label className="field">
          <span className="field-k">Position</span>
          <select value={pos} onChange={(e) => setPos(e.target.value)}>
            {posOptions}
          </select>
        </label>

        <h3 className="sheet-section-h">Sort by</h3>
        <div className="sheet-rows">
          {SORTS.map((o) => (
            <button
              key={o.key}
              className={"picker-row" + (o.key === sort ? " is-on" : "")}
              aria-pressed={o.key === sort}
              onClick={() => pick(o.key)}
            >
              <span className="picker-label">{o.label}</span>
              {o.key === sort && <Dir size={20} strokeWidth={2} aria-label={asc ? "ascending" : "descending"} />}
            </button>
          ))}
        </div>

        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" onClick={() => setFiltersOpen(false)}>
            Show {rows.length} players
          </button>
          <button className="btn btn-ghost btn-block" onClick={clearFilters} disabled={activeFilters === 0}>
            Clear filters
          </button>
        </div>
      </Sheet>
    </>
  );
}

function Legend() {
  return (
    <div className="legend">
      Free agents (<span className="chip chip-solid chip-warning">FA</span>) are unrostered but fantasy-relevant (in the
      ADP list or 50+ points last season). <strong>Rostered</strong> counts seasons on a Los Socios roster — not NFL
      seasons, which are <strong>NFL exp</strong>. Keep $ / Rostered apply to rostered players only.
    </div>
  );
}

function Trending() {
  const s = useAsync(() => api.trending(), []);
  const isDesktop = useIsDesktop();
  if (s.loading) return <Loading what="trending players" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const rows = s.data ?? [];
  return (
    <>
      <p className="dim lede">Most-added players across Sleeper in the last 24 hours (waiver/pickup buzz).</p>
      {isDesktop ? (
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
                  <td>
                    <button className="plink" onClick={() => openPlayer(p.playerId)}>
                      {p.name}
                    </button>
                  </td>
                  <td>
                    <span className={"pos pos-" + p.position}>{p.position}</span>
                  </td>
                  <td className="dim">{p.nflTeam ?? "—"}</td>
                  <td className="r strong">{p.count.toLocaleString()}</td>
                  <td className={p.rostered ? "dim" : ""}>
                    <Owner p={p} />
                  </td>
                  <td className="r">{pts(p.lastSeasonPoints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <RowList>
          {rows.map((p: TrendingRow, i) => (
            <Row
              key={p.playerId}
              leading={<span className="row-rank">{i + 1}</span>}
              title={
                <>
                  <button className="plink" onClick={() => openPlayer(p.playerId)}>
                    {p.name}
                  </button>
                  <span className={"pos pos-" + p.position}>{p.position}</span>
                </>
              }
              meta={
                <>
                  <span>{p.nflTeam ?? "—"}</span>
                  <span>·</span>
                  <Owner p={p} />
                </>
              }
              /* Adds is what this list ranks by, so it is what the row leads with. */
              metric={p.count.toLocaleString()}
              metricLabel="adds"
              details={[{ k: "last pts", v: pts(p.lastSeasonPoints) }]}
            />
          ))}
        </RowList>
      )}
    </>
  );
}

export function PlayersView() {
  const [sub, setSub] = useState<Sub>("all");
  return (
    <section>
      <div className="head-row">
        <h2>Players</h2>
        <div className="seg">
          <button className={sub === "all" ? "is-on" : ""} onClick={() => setSub("all")}>
            All players
          </button>
          <button className={sub === "trending" ? "is-on" : ""} onClick={() => setSub("trending")}>
            Trending
          </button>
        </div>
      </div>
      {sub === "all" ? <AllPlayers /> : <Trending />}
    </section>
  );
}
