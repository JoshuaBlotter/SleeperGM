# Draft-prep toolkit (v2) — feature specs

> Extracted from `spec.md` §14 to keep the main spec lean. The core data model, house rules, and shipped
> v1 milestones stay in [../spec.md](../spec.md); post-v1 issue specs (rookie board, data page, value
> sources) are in spec.md §13. Section numbers (§14.x) are preserved so existing cross-refs still resolve.
> Per-feature docs can split out from here if any one feature balloons during implementation.

## 14. Draft-prep toolkit (v2)

Five features that turn Sleeper GM from a keeper/inflation tool into a **draft-day assistant**. They form
a dependency chain, so build order matters. Kept the user's original numbering (#1–#5) as stable ids.

**Build order (agreed):** ship the data-ready, high-insight enablers first, then the capstones.
1. **#2 Historical draft value** — full spec §14.1 — ✅ **shipped**
2. **#5 Player drilldown** — full spec §14.2 — ✅ **shipped**
3. **#3 Positional scarcity map** — full spec §14.3 — ✅ **shipped**
4. **#4 Tier board builder** — light spec §14.4 — ✅ **shipped**
5. **#1 Draft target assistant** — light spec §14.5 *(next / capstone; consumes #3/#4/#5 + need engine)*

**Shared availability caveat (applies to #1 and #3):** "who's available in the auction" is unreliable
until managers lock keepers (most haven't streamlined their rosters yet). Every feature that needs
availability must degrade gracefully: default to an **"assume all rostered = kept"** model now, expose the
assumption, and tighten automatically as keeper choices firm up. Never present approximate availability as
fact.

**Shared data-layer additions these need (build once, reuse):**
- **Per-week points** — `seasonPoints` currently sums weekly `matchups`; add a sibling that keeps the
  `playerId -> week -> points` grid (last completed season). Feeds #5 (drilldown) and #4/#1 archetypes.
- **Auction-draft index** — `buildDraftIndex` already captures auction `amount` + `isKeeper` per player
  per season. Expose "last season's auction buys" (source=auction, !isKeeper) for #2.
- **Per-position value ranks + kept flags** — rank the value map within each position and tag
  rostered/kept. Feeds #3 (scarcity), #4 (tiers), #1 (targets).

---

### 14.1 Historical draft value (#2 · full) — ✅ SHIPPED 2026-08-07
Built: pure `engines/draftValue.ts` (`buildDraftValueReport`) + `loadDraftValue(ctx,data)`; CLI
`sgm draft-value`; `/api/draft-value?source=`; baked per-source into `bySource[src].draftValue`; web
**Market** page (Inflation renamed) with **Inflation / Last-year auction** sub-tabs. Source-aware (worth
follows the value dropdown). Verified live: 2025 auction spent $1122 for $567 of 2026 adp-projected value;
McCaffrey $69→$83 (kept $76). Scatter view (open question) not built; table + summary cards shipped.

**Problem:** are we projecting this year's values as high as last year's *actual* auction prices? Some 2025
auction buys got expensive (e.g. Christian McCaffrey, Derrick Henry) — are we about to overpay again, or
are they cheaper now?

**Data (ready):** `buildDraftIndex` has every 2025 auction `amount`; active value source gives 2026
projected worth; keeper engine gives 2026 keeper cost if the player is now kept.

**FR**
- FR1 List **last season's auction buys** (draft source = auction, `isKeeper = false`) — excludes carried
  keepers and rookie-draft picks, per the ask.
- FR2 Per player: `2025 auction $`, `2026 projected worth` (active source), **delta** ($ and %), and a flag
  if they're now a **kept** player (with their 2026 keeper cost) vs back in the pool.
- FR3 Sort by delta (biggest risers/fallers) and by 2025 cost; filter by position.
- FR4 A one-line league read: "last year's auction spent $X for $Y of projected value" (over/under-pay).

**AC**
- McCaffrey & Henry appear with their 2025 auction price and 2026 projected worth, delta shown.
- A 2025 auction buy who is now a keeper is labeled as such (not shown as re-auctionable).
- Carried keepers and rookie picks never appear.

**Placement:** the **Inflation page becomes a hub** with sub-tabs (mimic Players): **Overview** (current
inflation), **Last-year auction** (this feature), **Scarcity** (#3). Keeps all market analysis in one place.

**Open:** table vs scatter (2025 $ x-axis, 2026 worth y-axis, diagonal = "same"); include FAAB pickups or
auction only (lean auction-only); league-wide vs filter-by-team.

---

### 14.2 Player drilldown (#5 · full) — ✅ SHIPPED 2026-08-07
Built: pure `engines/playerDetail.ts` (`gradePlayer`, 5 tests) + per-week enabler `seasonWeeklyPoints`/
`weeklyPoints` in `engines/points.ts` + `loadPlayerDetails(ctx,data)` (source-independent, baked whole as
`bundle.playerDetails`, `/api/player-details`). Web: a **modal** opened by clicking any player name
(Players All+Trending, Team board) via a tiny `playerModalStore` — weekly bar chart (boom/bust colored),
A/B/C grade **off the median**, archetype (consistent/steady/boom-bust/one-week-wonder/injury-limited),
stat chips, keeper context. Verified: Kyle Pitts C / boom-bust (median 7.9 vs 199 total); McCaffrey A /
steady (23.8 ppg). Thresholds live in the engine (estimates — tune there). No CLI (web-only feature).

**Problem:** a season total hides *how* it was scored. Kyle Pitts was a TE1 by total on the back of one
record week but was otherwise unstartable; Ashton Jeanty is boom-bust. Total points alone mislead the draft.

**Data (ready):** weekly `matchups` (`players_points`) — already fetched for `seasonPoints`; keep the
per-week grid instead of only the sum.

**FR**
- FR1 Reachable by **clicking a player anywhere** (Players list, Team board, prospects) -> a drilldown
  panel (modal/drawer — the app has no router, so an overlay).
- FR2 Show last season **week-by-week** fantasy scores (bar/sparkline), **total**, **PPG**, games played,
  best/worst week, and a boom/bust count (weeks above "boom" line / below "bust" line).
- FR3 A **consistency grade** (A/B/C) from positional weekly thresholds (starting estimates, confirm):
  WR/RB — A ~15+ PPG, B 12–15, C <10-ish; QB/TE scaled. Grade off *median* weekly (not mean, which one huge
  week skews) and/or % of weeks above the position's startable floor.
- FR4 An **archetype** label: *consistent* (low variance), *boom-bust* (high variance / few big weeks),
  *one-week-wonder* (one week is an outsized share of the total — the Pitts case), *injury-limited* (few
  games). Derived from coefficient of variation + max-week share of total + games played.
- FR5 Context row: 2026 projected worth, keeper cost (if rostered), rookie flag.

**AC**
- Kyle Pitts: total looks TE1-ish but drilldown flags **one-week-wonder / low consistency (C)**.
- A steady producer grades **A / consistent** with a flat weekly bar chart.
- Grade uses median, so a single 40-pt week doesn't lift a C to an A.

**Decisions / assumptions:** PPR scoring (league default); "last season" = last completed season in the
chain; thresholds live in config so they're tunable. K/DEF get a simplified grade or none.

**Open:** exact grade thresholds per position (user gave rough WR numbers — confirm); modal vs dedicated
route; how far back (one season now; multi-season trend later).

---

### 14.3 Positional scarcity map (#3 · full) — ✅ SHIPPED 2026-08-07
Built: pure `engines/scarcity.ts` (`computeScarcity`, 3 tests) + `loadScarcity(ctx,data)`; CLI
`sgm scarcity`; `/api/scarcity?source=`; baked per-source `bySource[src].scarcity`; web **Market →
Scarcity** sub-tab (per-position bars hot/warm/cool + kept/available counts + best-available + top-N
reveal). **Decision:** "kept" = **rational keeper** (rostered AND worth ≥ keeper cost), NOT raw rostered —
before keepers lock, raw-rostered reads 100% everywhere; the surplus proxy differentiates positions.
Verified: RB 83% scarce (9/12), WR 100%, QB 52%, TE 39% — matches the user's RB-run thesis.

**Problem:** when most of a position's top tier is kept, the auction pool for that position is gutted and
prices spike — the user estimates ~8 of the top 12 RBs are kept. League-wide inflation (existing) hides
this; scarcity is *per position*.

**Data:** per-position value ranks + kept/rostered flags (shared addition); existing keeper boards.

**FR**
- FR1 Per position (QB/RB/WR/TE), show the **top-N by value** with each marked **kept vs available**.
- FR2 A **scarcity score** per position: share of top-tier value that's off the board, e.g.
  `1 - (available top-12 value / total top-12 value)`. Render as a bar/heat indicator.
- FR3 Surface the **best still-available** player per position and the count kept/available in the top tier.
- FR4 (stretch) A per-position **inflation lean** — positions with high scarcity will run hotter than the
  league multiplier; show a relative "RB runs hot / WR runs cool" read.

**AC**
- RB shows the highest scarcity (most of the top tier kept), with a "8/12 top RBs kept"-style count.
- Positions with a deep available pool read as low scarcity.
- Uses the availability model + caveat above (kept = rostered/rational-keeper proxy until locks firm up).

**Placement:** **Inflation -> Scarcity** sub-tab (see §14.1).

**Open:** scarcity formula (value-weighted vs simple count); top-N window (12? = one starter/team); whether
to derive a real per-position multiplier or just a relative heat read for v1.

---

### 14.4 Tier board builder (#4 · light) — ✅ SHIPPED 2026-08-07
Built: pure `engines/tiers.ts` — `tierize` (gap-cluster: new tier when the drop ≥ `max(minGap,
min(gapPct×prev, absBreak))`; the absBreak cap splits smooth high-value curves) + `bandize` (fixed $
bands for cross-position); 4 tests. `loadTiers(ctx,data)` → `{ byPosition (gap tiers), overall (bands) }`,
baked per source. CLI `sgm tiers`; `/api/tiers?source=`; web **Tiers** tab (By position selector /
Overall value bands; chips open the #5 drilldown). Verified: Josh Allen alone in QB Elite; McBride+Bowers
top TE tier; McBride cross-position in the $14–21 band with Nabers/Higgins/Adams. Gap params live in the
engine (tunable). Manual tier overrides = future.

**Problem:** a flat value ranking hides tier cliffs. Josh Allen (~360) sits a tier above the Herbert/
Mahomes/Goff/Prescott pack (~280); Trey McBride belongs with elite WRs (Amon-Ra, Chase) by value, not in
"later-round TE." Drafting by tier (not rank) is how you exploit those gaps.

**Approach (sketch):** **gap-based clustering** on projected value (or points) — start a new tier when the
drop between consecutive players exceeds a threshold (relative %, or a positional absolute). Two views:
per-position tiers (QB/RB/WR/TE) and a cross-position **value tier** (McBride grouped with Chase/Amon-Ra).

**FR (sketch):**
- Auto-tier each position with a tunable gap threshold; label tiers (Elite / T2 / T3 ...).
- Cross-position value tiers so you can compare "is this TE worth a WR-tier price?"
- Later: manual tier overrides (drag/pin a player) persisted like the value overrides.

**Depends on:** value ranks (have). **Feeds:** #1 (targets reason about "best available in the current
tier"). **Placement:** own **Tiers** tab, or a mode on Players. **Open:** gap-threshold tuning; per-position
vs global; manual-override UX.

---

### 14.5 Draft target assistant (#1 · light · capstone)
**Problem:** given my roster and my kept set, who should I actually target in the auction/rookie draft?

**Approach (sketch):** a ranked, explained target list for the selected team that scores each *available*
player by:
- **Positional need** — `baseSlots - startable` (already in the trades engine).
- **My kept set** — reads the Team page's interactive keeper selection (see cross-tab note).
- **Stack bonus** — reward pass-catchers (WR/TE) on the **same NFL team as my kept QB** (QB-WR/TE stacks).
- **Diversity / correlation penalty** — discourage over-concentration on one NFL team (bye-week &
  correlated-outcome risk) — e.g. don't pile a RB onto a roster already stacked with that team's QB+WR.
- **Value / surplus** — prefer positive-surplus, tier-aware picks (uses #4 tiers, #5 archetypes).
- **Availability** — only suggest gettable players (approximate now; see shared caveat).

**FR (sketch):**
- A **Targets sub-tab on the Team page** (mimic the Players sub-tabs), scoped to the selected team + its
  kept set; each suggestion shows a short "why" (fills RB need · stacks with Allen · positive surplus).
- Toggles: "assume all available", weight sliders (need vs value vs stack) later.

**Cross-tab kept-set problem (design note):** the keeper sim (checkboxes) currently lives inside the Team
view. To feed Targets, **lift the kept-set state to the Team page container** and share it across
`Keepers | Targets` sub-tabs (or persist per-team in `localStorage`, like value overrides). This is the
main new architectural piece.

**Depends on:** #3 (scarcity), #4 (tiers), #5 (archetypes), existing need engine. **Build last.**
**Open:** scoring weights & formula; stack/diversity math; availability model; how aggressively to factor
scarcity into suggested price.
