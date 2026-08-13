import type { SalaryEvent, SalarySeason } from "./api";
import { money, signed } from "./ui";

/**
 * How a salary was set, in words a manager uses. `free_agent` is a $0 waiver claim, which reads as
 * a claim rather than "free agent" — the player was claimed, they aren't a free agent now.
 */
export const EVENT_LABEL: Record<SalaryEvent, string> = {
  auction: "won at auction",
  faab: "waiver bid",
  free_agent: "waiver claim",
  rookie: "rookie pick",
  kept: "kept",
  traded: "traded for",
  unknown: "unknown",
};

/** The compact form, for a table cell where the season already supplies the sentence. */
export const EVENT_SHORT: Record<SalaryEvent, string> = {
  auction: "auction",
  faab: "waivers",
  free_agent: "waivers",
  rookie: "rookie",
  kept: "kept",
  traded: "trade",
  unknown: "—",
};

/**
 * The salary notation the rest of the app already uses: † a figure that comes from the
 * commissioner's sheet, ≈ one we replayed and can't fully vouch for.
 */
export function salaryMark(source: SalarySeason["source"] | null, approximate: boolean): string {
  if (approximate) return "≈";
  return source === "sheet" ? "†" : "";
}

/**
 * A player's salary, season by season (#19). Deliberately not a `table.grid` — that sets
 * `white-space: nowrap` on every cell and this has to fit a 390px sheet, so it is a four-column
 * grid that can wrap the "how" column instead of scrolling sideways.
 */
export function SalaryLadder({ rows }: { rows: SalarySeason[] }) {
  return (
    <ol className="ladder">
      {rows.map((r) => (
        <li className="ladder-row" key={r.season}>
          <span className="ladder-season">{r.season}</span>
          <span className="ladder-how">
            {EVENT_LABEL[r.event]}
            {r.note && <span className="ladder-note">{r.note}</span>}
          </span>
          <span className="ladder-raise">{r.increase == null ? "" : signed(r.increase)}</span>
          <span className={"ladder-salary" + (r.approximate ? " is-approx" : "")}>
            {money(r.salary)}
            <span className="ladder-mark" aria-hidden="true">
              {salaryMark(r.source, r.approximate)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The footnote that explains the two marks — only the ones actually on screen. */
export function SalaryKey({ rows }: { rows: { source: SalarySeason["source"] | null; approximate: boolean }[] }) {
  const sheet = rows.some((r) => r.source === "sheet");
  const approx = rows.some((r) => r.approximate);
  if (!sheet && !approx) return null;
  return (
    <p className="legend">
      {sheet && (
        <>
          <strong>†</strong> from the commissioner's salary sheet — authoritative.{" "}
        </>
      )}
      {approx && (
        <>
          <strong>≈</strong> replayed from the draft record, and the sheet disagrees with where the replay landed. The
          sheet wins; these earlier years are our best reconstruction, not the league's books.
        </>
      )}
    </p>
  );
}
