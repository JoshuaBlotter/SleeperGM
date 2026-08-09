import { useState } from "react";
import { api, type Tier } from "../api";
import { ErrorBox, Loading, money, useAsync } from "../ui";
import { openPlayer } from "../playerModalStore";

type Sub = "position" | "overall";
const POS = ["QB", "RB", "WR", "TE"];

function TierBands({ tiers, showPos }: { tiers: Tier[]; showPos?: boolean }) {
  if (!tiers.length) return <p className="dim">No values from this source.</p>;
  return (
    <div className="tier-list">
      {tiers.map((t) => (
        <div className="tier-band" key={t.tier}>
          <div className="tier-label">
            <span className="strong">{t.label}</span>
            <span className="dim">
              {t.minValue === t.maxValue ? money(t.maxValue) : `${money(t.maxValue)}–${money(t.minValue)}`}
            </span>
          </div>
          <div className="tier-chips">
            {t.players.map((p) => (
              <button className="tier-chip" key={p.playerId} onClick={() => openPlayer(p.playerId)} title="Player detail">
                {showPos && <span className={"pos pos-" + p.position}>{p.position}</span>}
                <span className="strong">{p.name}</span>
                <span className="dim">{money(p.value)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
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
        <div className="subtabs">
          <button className={sub === "position" ? "active" : ""} onClick={() => setSub("position")}>
            By position
          </button>
          <button className={sub === "overall" ? "active" : ""} onClick={() => setSub("overall")}>
            Overall value
          </button>
        </div>
      </div>

      <p className="dim" style={{ marginTop: 0 }}>
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
          <div className="filters">
            {POS.map((p) => (
              <button key={p} className={"subtabs-btn " + (pos === p ? "on" : "")} onClick={() => setPos(p)}>
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
