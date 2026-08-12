import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, type RulesResp } from "../api";
import { Row, RowList } from "../Row";
import { ErrorBox, Loading, useAsync, useIsDesktop } from "../ui";

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

/**
 * The five rules that aren't a table or a number — one card each, so the page has no loose
 * bulleted list floating between its cards. Two of them read their wording off the rulebook.
 */
function otherRules(rules: RulesResp["rules"]): { title: string; body: string }[] {
  return [
    { title: "Waiver pickups", body: "A waiver-acquired player's keeper cost is the FAAB bid you paid to get them." },
    {
      title: "Cut & re-acquire",
      body: `Cutting a player and picking him back up ${
        rules.resetCostOnReacquire ? "resets his cost to the new acquisition price" : "does not reset his cost — the accumulated salary follows him"
      }.`,
    },
    { title: "Trades", body: "Traded players carry their accumulated salary. Only the years-kept clock resets." },
    {
      title: "Taxi & IR",
      body: `Taxi and IR players ${
        rules.taxiCountsAgainstCap ? "count" : "do not count"
      } against the cap, and are priced like any other player.`,
    },
    { title: "Kickers & defenses", body: "Streamers — roughly $0 of market value, and rarely worth a keeper slot." },
  ];
}

/**
 * The contender index drives the Dashboard's archetypes and awards, but nothing on the site said
 * what it measures. The weights stay visible; the caveats — especially that it RANKS rather than
 * grades — go behind an expander so this stays a card and not an essay.
 */
function ContenderIndexCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="info-card explainer">
      <h4>Contender index</h4>
      <p>
        A 0–100 score on the Dashboard for how ready a team is to win <em>now</em>. It sets each team's
        archetype, orders the team list, and picks the Prime Contender and Deepest Rebuild awards.
      </p>
      <dl className="deflist">
        <dt>30%</dt>
        <dd>roster value — total worth of rostered skill players</dd>
        <dt>30%</dt>
        <dd>keeper surplus — total positive surplus, i.e. how many cheap studs you hold</dd>
        <dt>25%</dt>
        <dd>last season's wins</dd>
        <dt>15%</dt>
        <dd>roster age — mean NFL experience</dd>
      </dl>
      <button className="card-expander" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        How to read it
        <ChevronDown className="row-chev" size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        <div className="explainer-body">
          <p>
            <strong>Older scores higher.</strong> Age is not a quality signal here, it is an urgency one — an
            old roster means the window is now, not that the team is building.
          </p>
          <p>
            <strong>It ranks, it does not grade.</strong> Every input is rescaled against the other eleven
            teams, so whoever has the lowest roster value scores zero on that input by construction, not
            because the roster is worthless. The scale also shifts whenever the data or the value source
            changes, so a 61 this week and a 61 next season are not the same claim.
          </p>
          <p>
            <strong>One outlier flattens the middle.</strong> With twelve teams, a single extreme value
            compresses everyone else on an input worth 30% of the score.
          </p>
          <p>
            <strong>Archetypes come from thirds.</strong> Top third is <em>contender</em>, or{" "}
            <em>win-now</em> if the roster is old or has sold its rookie picks. Bottom third is{" "}
            <em>rebuilding</em> if it is young or stocked with picks, otherwise <em>retooling</em>. Everyone
            else is <em>balanced</em>.
          </p>
          <p>
            Tendency tags, regret and boom-bust volatility show up in a team's profile but do{" "}
            <strong>not</strong> move the index.
          </p>
        </div>
      )}
    </div>
  );
}

/** 12 slots × 4 positions is a matrix, so it stays a table — one position at a time on a phone. */
function RookieCostTable({ table }: { table: Record<string, Record<string, number>> }) {
  const isDesktop = useIsDesktop();
  const [pos, setPos] = useState("RB");
  const columns = isDesktop ? POS : [pos];
  return (
    <>
      {!isDesktop && (
        <div className="seg">
          {POS.map((p) => (
            <button key={p} className={pos === p ? "is-on" : ""} onClick={() => setPos(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <table className="grid table-narrow">
        <thead>
          <tr>
            <th>Slot</th>
            {columns.map((p) => (
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
              {columns.map((p) => (
                <td key={p} className="r">
                  ${table[slot]?.[p] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

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

      {outstanding.length > 0 && <div className="notice error">Outstanding (placeholders): {outstanding.join(" · ")}</div>}

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

      {/* The formula annotates the heading rather than floating above the list as its own
          paragraph — same pattern as the Dashboard's superlatives header. */}
      <div className="head-row">
        <h3>Keeper escalation (every offseason)</h3>
        <span className="dim caption">new salary = old salary + increase</span>
      </div>
      <RowList>
        {POS.map((p) => (
          <Row
            key={p}
            title={<span className={"pos pos-" + p}>{p}</span>}
            meta="+ years kept"
            metric={`+$${esc.positionalBase[p] ?? 0}`}
            metricLabel="base increase"
          />
        ))}
        <Row
          title={<span className="pos">K / DEF</span>}
          meta="flat, per year"
          metric={`+$${esc.flatIncrease}`}
          metricLabel="base increase"
        />
      </RowList>

      <h3>Rookie starting salary (by draft slot × position)</h3>
      <RookieCostTable table={rules.rookieCost.table} />

      <h3>Player value — how "worth" is calculated</h3>
      <div className="deck">
        {/* The overview leads the glossary instead of floating above it as loose prose. */}
        <div className="info-card">
          <h4>What "worth" means</h4>
          <p>
            The auction dollars a player is projected to command. The <strong>values</strong> picker in the context
            strip switches which source drives worth, surplus, inflation, and trades. Manual overrides (if any) always
            win. {activeSource ? <>Currently active: <strong>{activeSource}</strong>.</> : null}
          </p>
        </div>
        {sources.map((src) => {
          const info = SOURCE_INFO[src];
          return (
            <div className="info-card" key={src}>
              <h4>
                {info?.label ?? src}
                {src === activeSource && <span className="chip chip-solid chip-accent">active</span>}
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

      <h3>Team profiles — the contender index</h3>
      <ContenderIndexCard />

      <h3>Other rules</h3>
      {/* ONE card, not one per rule: five cards for five one-line rules is more chrome than
          content, and the deck's equal-height cells made short rules float in empty boxes. */}
      <div className="info-card explainer">
        <dl className="rule-list">
          {otherRules(rules).map((r) => (
            <div key={r.title}>
              <dt>{r.title}</dt>
              <dd>{r.body}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="legend">Source of truth: core/src/config/league-rules.ts</div>
    </section>
  );
}
