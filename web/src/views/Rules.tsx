import { api } from "../api";
import { ErrorBox, Loading, useAsync } from "../ui";

const SLOTS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const POS = ["QB", "RB", "WR", "TE"];

// Human descriptions for each value source. Unknown names (your own imports) get a generic blurb.
const SOURCE_INFO: Record<string, { label: string; blurb: string }> = {
  vorp: {
    label: "VORP (built-in)",
    blurb:
      "Value Over Replacement Player. Takes each player's ACTUAL fantasy points from last season, subtracts " +
      "the points of a replacement-level player at that position (the best guy who'd go undrafted in a 12-team " +
      "league), and converts those 'points above replacement' into auction dollars scaled to the 12×$200 pool. " +
      "It's fully offline and needs no external site — but it's backward-looking (last year's points), so it " +
      "under/over-rates players whose role changed.",
  },
  adp: {
    label: "ADP-derived",
    blurb:
      "Average Draft Position from Fantasy Football Calculator's public API (12-team PPR, current season), " +
      "converted to auction dollars via a convex ADP→$ curve scaled to the pool. This is a market/consensus " +
      "signal (where people actually draft), not one expert's list.",
  },
};

export function RulesView() {
  const s = useAsync(() => api.rules(), []);
  const league = useAsync(() => api.league(), []);
  if (s.loading) return <Loading what="rules" />;
  if (s.error) return <ErrorBox message={s.error} />;
  const { rules, outstanding } = s.data!;
  const esc = rules.keeperEscalation;
  const sources = league.data?.sources ?? [];
  const activeSource = league.data?.valueSource;

  return (
    <section>
      <h2>League Rulebook</h2>

      {outstanding.length > 0 && (
        <div className="notice error" style={{ marginBottom: 16 }}>
          Outstanding (placeholders): {outstanding.join(" · ")}
        </div>
      )}

      <div className="cards">
        <div className="card">
          <div className="k">Salary cap</div>
          <div className="v">${rules.capBudget}</div>
          <div className="k">auction budget</div>
        </div>
        <div className="card">
          <div className="k">Max keepers</div>
          <div className="v">{rules.maxKeepers}</div>
          <div className="k">effectively unlimited</div>
        </div>
      </div>

      <h3>Keeper escalation (every offseason)</h3>
      <p className="dim" style={{ marginTop: 0 }}>
        new salary = old salary + increase.
      </p>
      <table className="grid" style={{ maxWidth: 420 }}>
        <thead>
          <tr>
            <th>Position</th>
            <th className="r">Base increase</th>
            <th>Plus</th>
          </tr>
        </thead>
        <tbody>
          {POS.map((p) => (
            <tr key={p}>
              <td>
                <span className={"pos pos-" + p}>{p}</span>
              </td>
              <td className="r strong">+${esc.positionalBase[p] ?? 0}</td>
              <td className="dim">+ years kept</td>
            </tr>
          ))}
          <tr>
            <td>
              <span className="pos">K / DEF</span>
            </td>
            <td className="r strong">+${esc.flatIncrease}</td>
            <td className="dim">flat, per year</td>
          </tr>
        </tbody>
      </table>

      <h3>Rookie starting salary (by draft slot × position)</h3>
      <table className="grid" style={{ maxWidth: 420 }}>
        <thead>
          <tr>
            <th>Slot</th>
            {POS.map((p) => (
              <th key={p} className="r">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <td className="dim">{slot}</td>
              {POS.map((p) => (
                <td key={p} className="r">
                  ${rules.rookieCost.table[slot]?.[p] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Player value — how "worth" is calculated</h3>
      <p className="dim" style={{ marginTop: 0 }}>
        "Worth" is the auction dollars a player is projected to command. The <strong>values</strong> dropdown in
        the header switches which source drives worth, surplus, inflation, and trades. Manual overrides (if any)
        always win. {activeSource ? <>Currently active: <strong>{activeSource}</strong>.</> : null}
      </p>
      <div className="deck">
        {sources.map((src) => {
          const info = SOURCE_INFO[src];
          return (
            <div className="info-card" key={src}>
              <h4>
                {info?.label ?? src}
                {src === activeSource && <span className="pill-active">active</span>}
              </h4>
              <p>
                {info?.blurb ??
                  `Imported value list (config/values/${src}.csv) — paste a site's auction values into that file and it appears here.`}
              </p>
            </div>
          );
        })}
        <div className="info-card">
          <h4>overrides</h4>
          <p>
            Your manual per-player fixes in <code>config/values/overrides.csv</code> — these win over whatever
            source is selected.
          </p>
        </div>
      </div>

      <h3>Other rules</h3>
      <ul className="rules-list">
        <li>Waiver-acquired players' keeper cost = the FAAB bid paid to get them.</li>
        <li>Cut &amp; re-acquire {rules.resetCostOnReacquire ? "resets" : "does not reset"} cost to the new acquisition price.</li>
        <li>Traded players carry their accumulated salary; only the years-kept clock resets.</li>
        <li>Taxi &amp; IR {rules.taxiCountsAgainstCap ? "count" : "do not count"} against the cap; priced like any player.</li>
        <li>Kickers &amp; defenses are streamers (~$0 market value); rarely worth keeping.</li>
      </ul>
      <div className="legend">Source of truth: core/src/config/league-rules.ts + docs/league-rules.md</div>
    </section>
  );
}
