import { useState } from "react";
import { ChevronsDown } from "lucide-react";
import { api, type Tier } from "../api";
import { ErrorBox, Loading, money, useAsync } from "../ui";
import { openPlayer } from "../playerModalStore";

type Sub = "position" | "overall";
const POS = ["QB", "RB", "WR", "TE"];

function TierBands({ tiers, showPos }: { tiers: Tier[]; showPos?: boolean }) {
  if (!tiers.length) return <p className="dim">No values from this source.</p>;
  return (
    <div className="tier-list">
      {tiers.map((t, i) => {
        const range = t.minValue === t.maxValue ? money(t.maxValue) : `${money(t.maxValue)}–${money(t.minValue)}`;
        // The overall board names a tier by its own dollar band, so there the label and the range
        // are the same string; only the positional board has a name worth printing beside the rank.
        const named = !t.label.startsWith("$");
        // The gap to the next band is the whole premise of the page — the cliff you should reach
        // across a tier break to stay above. It is data, so it goes between the bands.
        const next = tiers[i + 1];
        const cliff = next ? t.minValue - next.maxValue : 0;
        return (
          <div key={t.tier}>
            <div className={"tier-band tier-" + Math.min(t.tier, 3)}>
              <div className="tier-label">
                <span className="tier-rank">T{t.tier}</span>
                {named && <span className="strong">{t.label}</span>}
                <span className="dim">{range}</span>
                <span className="dim push">
                  {t.players.length} player{t.players.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="tier-chips">
                {t.players.map((p) => (
                  <button className="chip chip-neutral chip-interactive" key={p.playerId} onClick={() => openPlayer(p.playerId)} title="Player detail">
                    {showPos && <span className={"pos pos-" + p.position}>{p.position}</span>}
                    <span className="strong">{p.name}</span>
                    <span className="dim">{money(p.value)}</span>
                  </button>
                ))}
              </div>
            </div>
            {cliff > 0 && (
              <div className="tier-cliff">
                <ChevronsDown size={16} strokeWidth={1.5} aria-hidden="true" />
                {money(cliff)} cliff
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TiersView({ source }: { source?: string }) {
  const s = useAsync(() => api.tiers(source), [source]);
  const [sub, setSub] = useState<Sub>("position");
  const [pos, setPos] = useState("RB");

  return (
    <section>
      <div className="head-row">
        <h2>Tiers</h2>
        <div className="seg">
          <button className={sub === "position" ? "is-on" : ""} onClick={() => setSub("position")}>
            By position
          </button>
          <button className={sub === "overall" ? "is-on" : ""} onClick={() => setSub("overall")}>
            Overall value
          </button>
        </div>
      </div>

      <p className="dim lede">
        Players gap-clustered by projected value — a new tier starts at a real value cliff, not just the next rank. Draft
        by tier: reach for the last player in a tier before it breaks. Click a name for the drilldown.
      </p>

      {s.loading ? (
        <Loading what="tiers" />
      ) : s.error ? (
        <ErrorBox message={s.error} />
      ) : sub === "overall" ? (
        <TierBands tiers={s.data!.overall} showPos />
      ) : (
        <>
          <div className="seg">
            {POS.map((p) => (
              <button key={p} className={pos === p ? "is-on" : ""} onClick={() => setPos(p)}>
                {p}
              </button>
            ))}
          </div>
          <TierBands tiers={s.data!.byPosition[pos] ?? []} />
        </>
      )}
    </section>
  );
}
