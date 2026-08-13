import { useMemo, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { api, type RecapRow, type SeasonRecap } from "../api";
import { Row, RowList } from "../Row";
import { EVENT_SHORT, SalaryKey, salaryMark } from "../Salary";
import { openPlayer } from "../playerModalStore";
import { ErrorBox, Loading, money, signed, useAsync, useIsDesktop } from "../ui";

type Sub = "ledger" | "auction" | "rookie";

/** How last season's salary was set, plus the notation for how much we trust the figure. */
function basisLabel(r: RecapRow): string {
  const label = r.basis === "rookie" ? (r.note ?? "rookie") : EVENT_SHORT[r.basis];
  return label + salaryMark(r.lastSource, r.approximate);
}

/**
 * One column, in both of its forms. `csv` is what a spreadsheet wants — a bare number it can sum —
 * and `show` is what a reader wants, with the dollar sign and the sign on the raise. The download and
 * the table therefore stay the same columns in the same order without agreeing on formatting.
 */
interface Column {
  header: string;
  csv: (r: RecapRow) => string;
  show?: (r: RecapRow) => ReactNode;
  right?: boolean;
}

const dollars = (n: number | null) => (n == null ? "" : String(n));
const showDollars = (n: number | null, dash = "—") => (n == null ? dash : money(n));

/** A row is a summary; the drilldown's salary tab is the whole chain behind it. */
function PlayerLink({ r }: { r: RecapRow }) {
  return (
    <button className="plink" onClick={() => openPlayer(r.playerId)}>
      {r.name}
    </button>
  );
}

/**
 * Download the rows on screen. Built here rather than served as a file so it always matches what you
 * are looking at (filters included) and needs no endpoint — the static site has no server to ask.
 */
function download(name: string, columns: Column[], rows: RecapRow[]) {
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(c.csv(r))).join(","))].join("\r\n");
  // ﻿ so Excel reads it as UTF-8 rather than the local codepage — team names have real punctuation in them.
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadButton({ name, columns, rows }: { name: string; columns: Column[]; rows: RecapRow[] }) {
  return (
    <button className="btn btn-secondary" onClick={() => download(name, columns, rows)} disabled={!rows.length}>
      <Download size={18} strokeWidth={1.5} aria-hidden="true" />
      Download CSV ({rows.length})
    </button>
  );
}

function Table({ columns, rows }: { columns: Column[]; rows: RecapRow[] }) {
  return (
    <table className="grid">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.header} className={c.right ? "r" : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.playerId + (r.pickNo ?? "")}>
            {columns.map((c) => (
              <td key={c.header} className={c.right ? "r" : undefined}>
                {c.header === "Player" ? <PlayerLink r={r} /> : (c.show ?? c.csv)(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The shared mobile row: this season's salary is the metric, last season's is why. */
function RecapRows({ rows, recap }: { rows: RecapRow[]; recap: SeasonRecap }) {
  return (
    <RowList>
      {rows.map((r) => (
        <Row
          key={r.playerId + (r.pickNo ?? "")}
          title={
            <>
              <PlayerLink r={r} />
              <span className={"pos pos-" + r.position}>{r.position}</span>
            </>
          }
          meta={[r.ownerTeam ?? "not rostered", basisLabel(r)].join(" · ")}
          metric={r.thisSalary == null ? "—" : money(r.thisSalary)}
          metricLabel={recap.nextSeason}
          metricRole={r.thisSalary == null ? "muted" : undefined}
          details={[
            { k: `${recap.season} salary`, v: r.lastSalary == null ? "—" : money(r.lastSalary) + salaryMark(r.lastSource, r.approximate) },
            { k: "raise", v: r.delta == null ? "—" : signed(r.delta) },
            ...(r.byTeam ? [{ k: `drafted by`, v: r.byTeam }] : []),
            ...(r.pickNo ? [{ k: "pick", v: `#${r.pickNo}${r.note ? ` (${r.note})` : ""}` }] : []),
          ]}
        />
      ))}
    </RowList>
  );
}

/** The verification table: every player on a roster today, and the arithmetic behind their salary. */
function Ledger({ recap }: { recap: SeasonRecap }) {
  const [team, setTeam] = useState("");
  const [pos, setPos] = useState("");
  const [q, setQ] = useState("");
  const isDesktop = useIsDesktop();

  const teams = useMemo(() => [...new Set(recap.ledger.map((r) => r.ownerTeam).filter((t): t is string => !!t))].sort(), [recap]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recap.ledger.filter(
      (r) => (!team || r.ownerTeam === team) && (!pos || r.position === pos) && (!needle || r.name.toLowerCase().includes(needle)),
    );
  }, [recap, team, pos, q]);

  const columns: Column[] = [
    { header: "Player", csv: (r) => r.name },
    { header: "Pos", csv: (r) => r.position, show: (r) => <span className={"pos pos-" + r.position}>{r.position}</span> },
    { header: "Team", csv: (r) => r.ownerTeam ?? "" },
    { header: `${recap.season} via`, csv: basisLabel },
    { header: `${recap.season} $`, csv: (r) => dollars(r.lastSalary), show: (r) => showDollars(r.lastSalary), right: true },
    { header: "Raise", csv: (r) => dollars(r.delta), show: (r) => (r.delta == null ? "—" : signed(r.delta)), right: true },
    { header: `${recap.nextSeason} $`, csv: (r) => dollars(r.thisSalary), show: (r) => showDollars(r.thisSalary), right: true },
  ];

  return (
    <>
      <p className="dim lede">
        Every player on a roster today: what they cost in {recap.season}, what the escalation rule adds, and what they
        cost in {recap.nextSeason}. This is the table to reconcile against the workbook — the download carries whatever
        the filters below leave on screen.
      </p>
      <div className="cards">
        <div className="card">
          <div className="k">{recap.season} salaries</div>
          <div className="v">{money(recap.totals.ledgerLast)}</div>
          <div className="k">{recap.ledger.length} players still rostered</div>
        </div>
        <div className="card">
          <div className="k">Escalation</div>
          <div className="v">{signed(recap.totals.ledgerDelta)}</div>
          <div className="k">added across the league</div>
        </div>
        <div className="card highlight big">
          <div className="k">{recap.nextSeason} salaries</div>
          <div className="v">{money(recap.totals.ledgerThis)}</div>
          <div className="k">if every one were kept</div>
        </div>
      </div>

      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player…" aria-label="Search player" />
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
          <option value="">All positions</option>
          {["QB", "RB", "WR", "TE", "K", "DEF"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <DownloadButton name={`los-socios-${recap.nextSeason}-salary-ledger.csv`} columns={columns} rows={rows} />
      </div>

      {isDesktop ? <Table columns={columns} rows={rows} /> : <RecapRows rows={rows} recap={recap} />}
      <SalaryKey rows={rows.map((r) => ({ source: r.lastSource, approximate: r.approximate }))} />
    </>
  );
}

function Auction({ recap }: { recap: SeasonRecap }) {
  const isDesktop = useIsDesktop();
  const columns: Column[] = [
    { header: "Player", csv: (r) => r.name },
    { header: "Pos", csv: (r) => r.position, show: (r) => <span className={"pos pos-" + r.position}>{r.position}</span> },
    { header: "Bought by", csv: (r) => r.byTeam ?? "" },
    { header: `${recap.season} $`, csv: (r) => dollars(r.lastSalary), show: (r) => showDollars(r.lastSalary), right: true },
    { header: "Raise", csv: (r) => dollars(r.delta), show: (r) => (r.delta == null ? "—" : signed(r.delta)), right: true },
    { header: `${recap.nextSeason} $`, csv: (r) => dollars(r.thisSalary), show: (r) => showDollars(r.thisSalary, "dropped"), right: true },
    { header: "Rosters now", csv: (r) => r.ownerTeam ?? "nobody", show: (r) => r.ownerTeam ?? <span className="dim">nobody</span> },
  ];
  return (
    <>
      <p className="dim lede">
        Every bid from the {recap.season} auction, priciest first. Carried keepers never hit the board, so a long-held
        player is missing here and present in the ledger — that is the two lists doing different jobs, not a gap.
      </p>
      <div className="cards">
        <div className="card">
          <div className="k">{recap.season} auction spend</div>
          <div className="v">{money(recap.totals.auctionSpend)}</div>
          <div className="k">{recap.totals.auctionPicks} players</div>
        </div>
        <div className="card">
          <div className="k">Still rostered</div>
          <div className="v">{recap.auction.filter((r) => r.rostered).length}</div>
          <div className="k">of {recap.totals.auctionPicks} bought</div>
        </div>
      </div>
      <div className="toolbar">
        <span className="spacer" />
        <DownloadButton name={`los-socios-${recap.season}-auction.csv`} columns={columns} rows={recap.auction} />
      </div>
      {isDesktop ? <Table columns={columns} rows={recap.auction} /> : <RecapRows rows={recap.auction} recap={recap} />}
    </>
  );
}

function Rookies({ recap }: { recap: SeasonRecap }) {
  const isDesktop = useIsDesktop();
  const columns: Column[] = [
    { header: "Pick", csv: (r) => r.note ?? String(r.pickNo ?? "") },
    { header: "Player", csv: (r) => r.name },
    { header: "Pos", csv: (r) => r.position, show: (r) => <span className={"pos pos-" + r.position}>{r.position}</span> },
    { header: "Drafted by", csv: (r) => r.byTeam ?? "" },
    { header: `${recap.season} $`, csv: (r) => dollars(r.lastSalary), show: (r) => showDollars(r.lastSalary), right: true },
    { header: "Raise", csv: (r) => dollars(r.delta), show: (r) => (r.delta == null ? "—" : signed(r.delta)), right: true },
    { header: `${recap.nextSeason} $`, csv: (r) => dollars(r.thisSalary), show: (r) => showDollars(r.thisSalary, "dropped"), right: true },
  ];
  return (
    <>
      <p className="dim lede">
        The {recap.season} rookie draft in pick order. A rookie's salary comes from the §6.4 table for the slot they
        went at, not from a bid, which is why the {recap.season} column is flat across a round.
      </p>
      <div className="toolbar">
        <span className="spacer" />
        <DownloadButton name={`los-socios-${recap.season}-rookie-draft.csv`} columns={columns} rows={recap.rookie} />
      </div>
      {isDesktop ? <Table columns={columns} rows={recap.rookie} /> : <RecapRows rows={recap.rookie} recap={recap} />}
    </>
  );
}

export function HistoryView() {
  const [sub, setSub] = useState<Sub>("ledger");
  const s = useAsync(() => api.history(), []);
  if (s.loading) return <Loading what="league history" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const recap = s.data!;
  return (
    <section>
      <div className="head-row">
        <h2>History</h2>
        <div className="seg">
          <button className={sub === "ledger" ? "is-on" : ""} onClick={() => setSub("ledger")}>
            Salary ledger
          </button>
          <button className={sub === "auction" ? "is-on" : ""} onClick={() => setSub("auction")}>
            {recap.season} auction
          </button>
          <button className={sub === "rookie" ? "is-on" : ""} onClick={() => setSub("rookie")}>
            {recap.season} rookies
          </button>
        </div>
      </div>
      {sub === "ledger" ? <Ledger recap={recap} /> : sub === "auction" ? <Auction recap={recap} /> : <Rookies recap={recap} />}
    </section>
  );
}
