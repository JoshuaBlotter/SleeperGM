import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * The mobile list primitive: three zones at a 64px minimum, plus an optional expander
 * that reveals the columns a table would have shown as a key/value grid.
 *
 * Tapping the row toggles the expander; tapping anything interactive inside the title
 * block (the player name, say) does its own thing instead.
 */
export function Row({
  leading,
  title,
  meta,
  metric,
  metricLabel,
  metricRole,
  details,
  selected,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  metric?: ReactNode;
  metricLabel?: ReactNode;
  /** Colors the trailing metric: the number the screen is about. */
  metricRole?: "success" | "danger" | "muted";
  details?: { k: string; v: ReactNode }[];
  selected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expandable = !!details?.length;
  // Tapping the row expands it — unless the tap landed on a control the row contains
  // (the player name, the keep checkbox, the Worth editor), which does its own thing.
  const toggle = (e: { target: EventTarget | null }) => {
    if ((e.target as HTMLElement | null)?.closest("button, input, label, a")) return;
    setOpen((o) => !o);
  };
  return (
    <div className={"row" + (selected ? " is-selected" : "") + (open ? " is-open" : "")}>
      <div
        className="row-main"
        onClick={expandable ? toggle : undefined}
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onKeyDown={
          expandable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((o) => !o);
                }
              }
            : undefined
        }
      >
        {leading != null && <div className="row-lead">{leading}</div>}
        <div className="row-title-block">
          <div className="row-title">{title}</div>
          {meta && <div className="row-meta">{meta}</div>}
        </div>
        {metric != null && (
          <div className={"row-metric" + (metricRole ? " is-" + metricRole : "")}>
            <div className="row-metric-v">{metric}</div>
            {metricLabel && <div className="row-metric-k">{metricLabel}</div>}
          </div>
        )}
        {expandable && <ChevronDown className="row-chev" size={18} strokeWidth={1.5} aria-hidden="true" />}
      </div>
      {expandable && open && (
        <dl className="row-details">
          {details!.map((d) => (
            <div className="row-detail" key={d.k}>
              <dt>{d.k}</dt>
              <dd>{d.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Wrapper so a list of rows gets one border and no double dividers. */
export function RowList({ children }: { children: ReactNode }) {
  return <div className="row-list">{children}</div>;
}
