# PROGRESS — living state

> Updated as work happens. Read this right after `CLAUDE.md` to know where things stand.
> Last updated: 2026-08-05 (initial build session — M0–M3 slices working end-to-end).

## Status snapshot
- **Health:** `npm run check` is GREEN — typecheck clean, 38/38 tests pass.
- **All six CLI commands work against the live league** (`dashboard`, `team`, `rulebook`, `keepers`,
  `simulate`, `refresh`).
- **All house rules are REAL** (no placeholders): §6.1 positional escalation, §6.4 rookie table,
  per-owner tenure reset, and salary that **accumulates through trades**.
- **Authoritative salaries imported** from the commissioner's workbook → `config/salaries.csv`
  (Season 2025, 163 players). App reads CSV (preferred) and escalates one year → exact 2026 salaries
  (A.J. Brown $45, Pickens $35, Hurts $29, Achane $25, McConkey $16). Sheet salaries show `†`; players
  not in the sheet fall back to computed (`≈`).

## Shipped 2026-08-11 (mobile design system, task 6.4 — **PR 6 complete**)
- **6.4 Trades**: chips / dead weight / buy-low targets become rows below 760px (surplus trailing,
  worth and salary in the expander), tables above. The six-column swap table becomes a **swap card** at
  every width — give above, get below, `my surplus` and `my cap` as trailing metrics, with `from <team>`,
  the salary swap and the fit mark in a footer. Sharky and mutual-fit are told apart by a 3px left
  accent (warning vs success) and the footer chip, not only by the heading. Partner select and the
  Sharky toggle were already in `.toolbar` from PR3. All empty-state copy is unchanged.
- **PR 6 is done.** The only block-scrolling table left on mobile is the Dashboard standings; Rules'
  two tables fit at 390px. Both belong to **PR 7.1**, after which `table.grid`'s
  `display:block; overflow-x:auto` can finally go (7.2).
- **Next open task: 7.1 Dashboard + Rules.**

## Shipped 2026-08-11 (mobile design system, task 6.3)
- **6.3 Tiers + Rookies**. **Tiers** — chips were already `.chip-interactive` from PR2 and measure a
  true 44px; the tier bands take the card padding step (`--space-3` → `--space-4`). **Rookies** — the
  prospect grid becomes rows at every width, and `.prospect-grid` / `.prospect` / `.prospect-rank` /
  `.prospect-name` plus the 760px query are deleted. The pick board and draft-capital tables become
  rows below 760px (pick label as a leading chip, slot costs on the meta line, net as the trailing
  metric); the base-order reveal keeps its `<details>` and gets the new summary: 44px, Lucide chevron,
  no `▸`/`▾` glyph.
- New: `.cost-pills.is-compact` unwraps the nested position chip to colored text so four slot-cost
  pills fit one row. Shared touch-ups: `.notice` gets a bottom margin, `.two-col > * > h3:first-child`
  loses its top margin (also tidies Inflation and Trades), three more inline styles gone.
- **Next open task: 6.4 Trades.**

## Shipped 2026-08-11 (mobile design system, task 6.2)
- **6.2 Market**: all three sub-tabs. **Inflation** — the two `.two-col` tables (biggest discounts,
  surplus by team) become rows below 760px with surplus as the trailing metric; `.two-col` already
  stacked by default since PR1. **Last-year auction** — rows with Δ trailing, its percentage on the
  same line (`.row-metric-v` is now `nowrap`), the two prices in the expander and the kept/pool status
  on the meta line; `.filters` here becomes the generic `.toolbar`. **Scarcity** — cards keep their
  bars, and the `<details class="reveal">` top-N reveal becomes a 44px `.card-expander` over rows that
  run to the card's edges. `.scar-row` and its only call site are deleted.
- Stat cards were already 2-per-screen at 390/430 and 4 across on desktop; no change needed.
- **Next open task: 6.3 Tiers + Rookies.**

## Shipped 2026-08-11 (mobile design system, task 6.1)
- **6.1 Players**: All + Trending render as rows below 760px. The four filters collapse to one sticky
  row — a search field plus a **Filters** button carrying an active-filter count — over a status line
  (`N players · <sort> ▼`) that keeps the count and the sort direction on screen while you scroll.
  Owner / NFL / position and the sort options live in a `Sheet`; the sortable table headers are gone on
  mobile. The trailing metric **follows the sort key** (last pts / keep $ / in league), so the number
  you sorted by is the number the row leads with, and the other two sit in the expander. Trending leads
  with adds. Empty results get a notice instead of an empty bordered box. Desktop is byte-for-byte the
  old table + `.filters` row.
- New: `.list-bar` (sticky under the context strip), `.field`/`.sheet-rows`/`.sheet-actions` for sheet
  forms, `--ctx-h`. The context strip is now a fixed 61px so the list bar has a constant offset to
  stick to.
- **Next open task: 6.2 Market.**

## Shipped 2026-08-10 (mobile design system, PRs 1–5 of 7)
Rollout plan: `design_handoff_mobile_design_system/TASKS.md` (7 PRs, 23 tasks). **PRs 1–6 are on `main`;
PR 7 is not started.** Nothing in `core/` changed — `web/` only.
- **PR1 tokens / PR2 controls** (earlier session): the `:root` token set, mobile-first CSS with one
  760px breakpoint, and `.btn` / `.seg` / `.input` / `.chip` collapsing ~20 ad-hoc treatments.
- **PR3 shell**: fixed bottom tab bar (Home · Team · Market · Players · More; Tiers/Trades/Rookies/
  Rules behind More), a sticky context strip under a 52px top bar carrying the team and value-source
  pickers, `lucide-react` for icons, and a generic `.toolbar` replacing the reused `.controls`/`.needs`.
- **PR4 sheet**: `web/src/Sheet.tsx` — bottom-anchored on mobile, centered dialog above 760px, with
  scroll lock, focus trap, focus return, Escape / scrim / swipe dismiss. The player drilldown and the
  team / value-source / More pickers all run on it. Desktop keeps native `<select>` pickers.
- **PR5 rows**: `web/src/Row.tsx` — the mobile list primitive. The keeper board and Targets render as
  rows below 760px and as today's tables above it, with a sticky keeper **sim bar** (cap left, keeping,
  used, sim surplus, reset) docked above the tab bar. Kept set and worth overrides behave as before.
- **Still open (PR6/PR7)**: Players, Market, Tiers, Rookies, Trades, Dashboard and Rules still render
  tables on mobile, so `table.grid` keeps `display:block; overflow-x:auto`. That rule is scheduled for
  deletion once the last table becomes rows — see DECISIONS 2026-08-10.
- Web is NOT covered by `npm run check`. Verify it with `npx tsc -p web/tsconfig.json --noEmit` and
  `npm run web:build`.

## Shipped 2026-08-09 (League Brain v3)
- **League Brain** (`specs/league-brain.md`): a "GM scouting report" on the **Dashboard**. Per-team
  **profile** (contender index 0–100 + archetype + tendency tags + a one-line witty scouting take) and
  league-wide **superlatives** (RB hoarder, pays up at QB, waits on TE, draft-capital baron, best keepers,
  wheeler-dealer, most valuable roster, prime contender, deepest rebuild). Answers the manager-behavior
  questions the user asked. Slight humor (deterministic templates, no RNG).
  - Pure `engines/leagueBrain.ts` (`computeLeagueBrain`, 6 tests) takes digested per-team numbers →
    profiles + awards; all league-relative math (means, ranks, min-max norm) lives here.
  - `loadLeagueBrain(ctx,data)` assembles inputs: roster value / keeper surplus / posCounts / avg
    `years_exp` from the surplus board; **auction spend by position** pooled per owner across the chain
    (`buildDraftSpendByOwner`, excludes carried keepers); **trade counts** per roster
    (`buildTradeCounts`, `type==="trade"` over all seasons — needs new `roster_ids` on `RawTransaction`);
    rookie capital from the rookie board; last-season wins from prev rosters.
  - Value-dependent → baked **per source** (`bySource[src].brain`); CLI `sgm brain`; `/api/brain?source=`.
  - Web: Dashboard shows a superlatives **deck** + a **brain-grid** of profile cards (archetype pill +
    tag chips + scouting line + mini stat row), each opening the Team page. Mobile: 0px overflow at 375.
  - Interpretation stated in-UI: "drafts QBs early" = **auction $ share** by position (no snake draft for
    vets), with a confidence note ("pooled over N auction seasons"). Verified live: Blotter trotters =
    wheeler-dealer (13 trades); KrespoKreme = prime contender (87) + most valuable ($307); Kupp my ballz =
    deepest rebuild (10) + draft-capital baron (3 picks). `npm run check` green — **89 tests** (was 83).
- **Brain v3.1 — 3 more signals (2026-08-09):** roster **volatility** (share of rostered skill players
  grading boom-bust/one-week-wonder → 🎢 Boom-or-Bust award + boom-or-bust/steady-floor tags), positional
  **age cliffs** (rostered RBs with `years_exp ≥ 5` → 👴 Geriatric Backfield + "aging RB corps" tag), and a
  **regret index** (last season's auction buys priced vs VORP-of-actual-production → 🪦 Buyer's Remorse +
  "last year's overpayer" tag; names the worst buy). All source-independent; 91 tests green. Live: Jahmyr =
  boom-or-bust (47%), Sunday Scaries = 4 veteran RBs, Jarhead = $28→$1 on DJ Moore.
- **Future brain ideas still on the shelf** (not built): cap flexibility, FAAB aggressiveness, trade
  network map, power ranking, trend-over-time. See `specs/league-brain.md` "Future ideas".

## Done
- Planning docs: `spec.md` (v0.2), `diagrams.md`, `tasks.md`.
- Repo scaffold + autonomy scaffolding (`CLAUDE.md`, this file, `DECISIONS.md`, `README.md`).
- **Core (all pure + unit-tested):** Sleeper client + TTL cache; players resolver; team registry;
  history chain walker; auction-price + FAAB extractors; provenance; rules config (Zod);
  engines — keeper cost, cap, points, valuation (VORP→$), surplus.
- **CLI:** `dashboard`, `team <name|#>`, `rulebook`, `keepers [--team]`, `simulate --team --keep`,
  `refresh`.
- **Scripts:** `npm run smoke` (live sanity — confirms chain 2026→2022, 120 priced players in 2025),
  `npm run fixtures` (snapshot live data).

## Next up (in order)
1. **Draft-prep toolkit (v2) — COMPLETE ✅** (`specs/draft-toolkit.md`): #2 historical value, #5 drilldown,
   #3 scarcity, #4 tiers, #1 target assistant all shipped. No queued feature work — awaiting the user's
   next direction. Standing follow-ups: fix the nightly deploy (commit + Pages→Actions flip), confirm
   rookie-draft round count, fill the other value-source import slots.
2. **Fix the nightly deploy** (see "Static hosting" below) — needs a push + one Pages setting flip.
3. **Confirm rookie-draft round count** — `rookieDraft.rounds` defaults to 1; bump in `league-rules.ts`
   once confirmed (logic already generalizes to N rounds).
4. Optional: fill the other import slots (cbs/draftsharks/footballguys); tune ADP→$ tau.

## Shipped 2026-08-07 (post-#1 fixes, user-reported)
- **QB-need pill didn't update on keeper toggle:** `positionalNeeds` counted only kept players worth ≥$12,
  so a cheap-in-ADP QB (Hurts $4) didn't fill the QB slot. Now it counts **any kept player** at a position
  (you're keeping him → slot filled). Core + web mirror + test updated.
- **Archetype "boom-bust" with 0 booms (Isaac TeSlaa):** added a **bust** archetype (0 booms + busts in
  ≥40% of weeks); boom-bust now requires ≥2 real boom weeks. TeSlaa → "bust". (89 bust / 77 boom-bust live.)
- **Targets availability made transparent:** added an **Avail** column — `FA` vs `cut? {team}` — so it's
  clear that rostered-but-projected-cut players legitimately appear (they return to the auction). The list
  still excludes your roster + projected keepers; "assume everyone available" overrides.
- **Deploy on commit:** added `push: branches:[main]` to `refresh.yml` so every commit rebuilds+redeploys
  (plus nightly + manual). Code is ready; still needs the one-time commit/push + Pages→Actions source flip.
- **Players page regression (from the stats-source switch) — FIXED:** the stats endpoint returns
  `TEAM_*` team-aggregate rows (huge `pts_ppr`) that leaked in as junk "players" (blank position, sorted
  to the top). `seasonPoints`/`seasonWeeklyPoints` now skip `id.startsWith("TEAM_")`. Real player ids are
  numeric; DEFs are 2–3-letter team codes (kept).
- **`data.json` trimmed** 1.69 MB → **1.39 MB**: target pool skips $0–2 FA scrubs (657→187 per source);
  player drilldowns require rostered OR ≥80 pts last season (412→296). Sorted Players top is correct again
  (McCaffrey 416, Nacua 375, Allen 374…).

## Shipped 2026-08-07 (draft toolkit #1 — CAPSTONE, toolkit complete)
- **#1 Draft target assistant** (`specs/draft-toolkit.md` §14.5): the **Team page is now Keepers / Targets
  sub-tabs** sharing a per-team **kept set** (`keptStore`, localStorage, seeded from recommended keepers).
  Targets ranks the available auction pool against *your live keeper selection*: positional need + value/
  tier + **QB-stack bonus** (WR/TE on your kept QB's team) + **NFL-team diversity penalty**, each with a
  "why" chip; "assume everyone available" toggle. Pure `engines/draftTargets.ts` (`computeDraftTargets` +
  `positionalNeeds`, 4 tests); scoring **mirrored client-side** in `views/Targets.tsx` (static site has no
  server — kept in sync with the core engine). `loadTargetPool` + `leagueStarterSlots`; baked
  `bySource[src].targetPool` + `league.starterSlots`; `/api/target-pool?source=`. Verified: check Hurts (QB)
  on Keepers → DeVonta Smith (PHI WR) rises to #1 on Targets with "stacks with Jalen Hurts".

## Shipped 2026-08-07 (points source = Sleeper STATS, not matchups) — correctness fix
- **Root cause the user caught:** weekly/season points came from league **matchups**, which only include
  **rostered** players → free-agent/breakout weeks were missing (Michael Wilson looked "injury-limited"
  because we only saw his rostered weeks 12–17). **Fix:** source all scoring from Sleeper's **stats**
  endpoint (`/v1/stats/nfl/regular/{season}/{week}`, new `sleeper.getWeekStats`, permanent-cached), which
  covers **every** player and whose `pts_ppr` matches this league's scoring **exactly** (vanilla PPR —
  verified Chase 2025: 290 league = 290 stats). `seasonPoints`/`seasonWeeklyPoints` now take an NFL
  **season year** and use `gp ≥ 1` so byes/DNPs are real gaps.
  - Wilson now shows his true log: 17 games, wks 1–7 & 9–18 (missing only wk 8), boom-bust — as the user
    said. Finishes now rank vs ALL players (Chase 2024 WR1 / 2025 WR4). VORP/Data "last pts" now cover FAs.
  - Removed the old matchup-summing `sumPoints`/`weeklyPoints` pure helpers. `data.json` ~1.4 MB (full
    game logs for 407 players + finishes; gzips to ~300 KB — fine for Pages).

## Shipped 2026-08-07 (drilldown refinements)
- **Player drilldown (#5) upgrades** per user feedback: (1) new **league-winner** archetype — grade A AND
  booms in ≥40% of weeks (CMC's 12 booms now read league-winner, not steady). (2) Modal shows **positional
  finish every season in the league** — `loadSeasonFinishes(ctx)` ranks each completed season's totals
  within position, baked into `PlayerDetail.finishes` (e.g. CMC 2025 RB1 · 2024 RB52 · 2023 RB1 · 2022 RB2).
- **Bugfix — weekly log is "weeks rostered", not NFL games.** The log only has weeks a player was rostered
  in the league, so a mid-season waiver breakout looked injured. Now the log is **week-tagged**
  (`WeekScore{week,points}`, via `weeklyPoints`/`seasonWeeklyPoints`): a short log that **starts late**
  (firstWeek ≥ 6) is a **late-riser** archetype, not injury-limited; the chart labels real week numbers and
  shows mid-season gaps; and the modal notes when data starts late. Michael Wilson: wk 12–17, grade A,
  now **late-riser** (was "injury-limited").

## Shipped 2026-08-07 (draft toolkit #4)
- **#4 Tier board** (`specs/draft-toolkit.md` §14.4): new **Tiers** tab. **By position** = gap-clustered
  tiers (a new tier at a real value cliff — `tierize` breaks when the drop ≥ `max(minGap, min(gapPct×prev,
  absBreak))`; the absBreak cap fixes fat top tiers on smooth RB/WR curves). **Overall value** = fixed $
  **bands** (`bandize`) for cross-position comparison. Pure `engines/tiers.ts` (4 tests); `loadTiers` baked
  per source; CLI `sgm tiers`; `/api/tiers?source=`; chips open the #5 drilldown. Live: Josh Allen alone in
  QB Elite; McBride+Bowers top TE; McBride cross-position in the $14–21 band with Nabers/Higgins/Adams.
- Also: renamed the nav tab **Inflation → Market** to match the hub (id stays `inflation` internally).

## Shipped 2026-08-07 (draft toolkit #5 + #3)
- **#5 Player drilldown** (`specs/draft-toolkit.md` §14.2): click any player name (Players All+Trending,
  Team board) → **modal** with last season's weekly bar chart (boom/bust colored), an **A/B/C
  consistency grade off the median**, an **archetype** (consistent/steady/boom-bust/one-week-wonder/
  injury-limited), stat chips + keeper context. Pure `engines/playerDetail.ts` (`gradePlayer`, 5 tests) +
  per-week enabler `seasonWeeklyPoints`/`weeklyPoints`. Source-independent → baked whole as
  `bundle.playerDetails` (247 players) + `/api/player-details`; opened via `playerModalStore`. Verified:
  Pitts C/boom-bust (median 7.9 vs 199 total), McCaffrey A/steady. Web-only (no CLI).
- **#3 Positional scarcity** (§14.3): **Market → Scarcity** sub-tab — per-position % of the top tier that's
  a projected keeper (off the board), hot/warm/cool bars, kept/available counts, best-available. Pure
  `engines/scarcity.ts` (`computeScarcity`, 3 tests) + `loadScarcity`; CLI `sgm scarcity`;
  `/api/scarcity?source=`; baked per-source. **"kept" = rational keeper (worth ≥ keeper cost)**, not raw
  rostered, so it differentiates before keepers lock. Live: RB 83% (9/12), WR 100%, QB 52%, TE 39%.

## Shipped 2026-08-07 (draft toolkit #2)
- **#2 Historical draft value** (`specs/draft-toolkit.md` §14.1): last season's **auction buys** (source =
  auction, `!isKeeper`; carried keepers + rookie picks excluded) vs this season's projected worth, with
  per-player Δ ($/%) and a kept/pool flag. Pure `engines/draftValue.ts` (`buildDraftValueReport`, 2 tests)
  + `loadDraftValue(ctx,data)`. CLI `sgm draft-value`; `/api/draft-value?source=`; baked **per source**
  under `bySource[src].draftValue`. Web: **Inflation page renamed "Market"** with **Inflation /
  Last-year auction** sub-tabs; source-aware; mobile-clean (height-capped scroll). Live: 2025 spent $1122
  for $567 of 2026 adp value (−$555) across 120 buys.

## Shipped 2026-08-07
- **M7** Data page = raw (NFL team col + filter; removed worth/surplus/call).
- **M8** Pluggable value sources: ADP-derived `config/values/adp.csv` (real, auto-refresh) overlaying
  VORP, + custom CSV import + `overrides.csv`; `SGM_VALUE_SOURCE` selects; `sgm values`; shown in web
  header. Fixed the bad values (Chase $87, A.J. Brown $47). CLI + server + snapshot all use it.
- **M9** Web value-source dropdown + Data-page refinement (user feedback):
  - Snapshot now bakes value-dependent view models (teams/inflation/trades) **per source** under
    `data.json → bySource[src]`; source-independent facts (team list, raw player rows) baked once.
    Web has a header **dropdown** (shown when >1 source) that switches everything client-side — no
    server. Server path mirrors this via `?source=` on `/api/league|team|inflation|trades` (raw
    `/api/players` is source-independent). Verified live: adp ×1.78 ⇄ vorp ×2.46.
  - New core helpers: `withValueSource(ctx,data,src)` (swap values on the same indexes),
    `worthSources()`, `leagueEntrySeason()`; `loadValues(ctx, source?, points?)` parameterized; last
    season's points computed once (`KeeperData.points`).
  - Data page is now "just player info": dropped Via/Season/Yrs-kept; added **Last pts** (last
    season's total fantasy points) and **In league** (seasons rostered by any manager). Still filter
    by fantasy team / NFL team / position. `/api/players` returns raw keeper lines (no worth).
- **M10** Value sources — clarity + real named slots + manual override (user feedback):
  - **VORP defined** in-app: Rules page has a "Player value — how worth is calculated" glossary
    (VORP, ADP-with-provenance = FFC public ADP, overrides, imported sources) that lists whichever
    sources are present and flags the active one.
  - **Named import slots** for the expert sites (can't be scraped — JS/login-gated): pre-made
    `config/values/{fantasypros,cbs,draftsharks,footballguys}.csv` with headers + paste instructions.
    `listValueSources()` now **hides header-only (unfilled) CSVs**, so a slot appears in the dropdown
    only once you paste real rows and re-snapshot. Fill → `npm run web:static` → shows up.
  - **Manual override editor (in-browser):** click any Worth on the Team board to set a custom value
    (persists in `localStorage`, key `sgm.overrides.v1`); ↺ resets one, "Reset all" clears them. Worth
    → surplus → keep/hold/cut recompute live and feed the keeper sim. Verified end-to-end in the
    browser. Note: overrides overlay the Team board only; Inflation/Trades keep baked values until a
    re-snapshot (or use the durable `config/values/overrides.csv`, which still wins everywhere).
  - **FantasyPros imported** (2026-08-07): pasted the site's 12-team/$200/PPR auction list into
    `config/values/fantasypros.csv` via `scratchpad/clean-fp.mjs` (rank/`Name (TEAM - POS)`/`$val` →
    `name,position,team,value`; JAC→JAX; "WR,CB"→WR; Hollywood→Marquise Brown). 314/315 matched (only
    FB Kyle Juszczyk unmatchable). Snapshot now bakes 3 sources: vorp, adp, **fantasypros** (default adp).
- **M6** Rookie draft prep board (issue #1) — DONE:
  - Confirmed Sleeper does NOT publish the 2026 rookie order (only the auction; `slot_to_roster_id`
    identity). Derived: base = **reverse 2025 regular-season standings** (wins asc, then points-for);
    playoff bracket only covers 4 teams so no clean 1–12 final rank. Traded picks applied from
    `/league/{id}/traded_picks` (roster_ids stable 2025↔2026).
  - Pure engine `engines/rookies.ts` (`computeRookieBoard`) + `loadRookieBoard(ctx)` orchestration;
    `rookieDraft` config (`rounds` default 1 + assumed flag, `snake`); `rookieSlotCost(slot,round)`.
    CLI `sgm rookies`, `/api/rookies`, snapshot `bundle.rookies`, web **Rookies** tab. 5 engine tests.
  - Verified live: Kupp holds 1.01/1.03(via Jarhead)/1.07(via Comedor) = +2; CTESPN 1.02/1.12(via
    KrespoKreme) = +1; the 3 sellers at −1.
  - **Rookie prospects list** (user ask: see more than 12 so stretch picks show): the incoming class
    (Sleeper `years_exp === 0`, skill positions) ranked by **ADP value** (the draft-market signal),
    source-independent, baked into `board.prospects` (+ `prospectSource`). `rankRookieProspects` pure
    helper. Depth is bounded by ADP coverage (~19 valued 2026 rookies); import a rookie-specific
    ranking for more. Shown on the CLI + web Rookies tab above the 12 pick slots.
- **Data page tweak** (2026-08-07): columns reordered to Player · Pos · NFL · Fantasy team · Last pts ·
  In league · Base $ · Keep $ · Src (name first; fantasy team kept but demoted).
- **Mobile pass 2** (2026-08-07, user-reported): root-caused the "wasted space on the right" — the header
  nav button row (531px) + `align-items:stretch` forced every header child (incl. brand) to 531 on a
  375 viewport → 168px page overflow. Fixes: nav **collapses to a full-width `<select>`** on ≤760px
  (new `.nav-select`); header children get `min-width:0; max-width:100%`. Verified: 375px page overflow
  168→0; tables fill width and scroll internally; desktop unchanged (button nav restored >760).
  **Refresh button** was misleading on the static site (data is baked; it just reloaded) → now static
  shows an **"updated <date>"** stamp (snapshot `generatedAt`); server mode keeps a real Refresh
  (clears cache). `LeagueResp.updatedAt`, `api.staticMode()`.
- **Players page** (2026-08-07, was "Data"): renamed **Data → Players**, now two sub-tabs:
  - **All players** — rostered players PLUS relevant **free agents** (previously missing). Relevance =
    in the ADP list OR ≥50 points last season, trimming the ~11k `players/nfl` dump (cached 24h) to
    ~300. FAs show an "FA" badge; Keep $/In-league blank for them. `core loadAllPlayers(ctx,data)`.
  - **Trending** — Sleeper's most-added players last 24h (`/players/nfl/trending/add`), with add counts +
    owner/FA tags. `core loadTrending(ctx,data)`. New `/api/trending`; snapshot bakes `players.trending`.
  - Source-independent (no worth shown). `AllPlayerRow`/`TrendingRow` in core; web `PlayersView`.
- **Mobile pass 3** (2026-08-07, user-reported): fixed Inflation/Rookies/Rules on phones.
  - **Rules** value glossary was a 2-col table; the mobile `white-space:nowrap` rule turned the prose
    cells into infinite horizontal scroll → converted to responsive **cards** (`.deck`/`.info-card`).
  - **Rookies** 4 stacked tables → **Prospects / Pick board** sub-tabs (matches Players); base order
    tucked into a `<details>` (`.reveal`). Fixed a 99px overflow: `.two-col > * { min-width:0 }` (grid
    tracks couldn't shrink, so inner tables forced the track wide — also fixed Inflation/Trades).
  - **Players** list capped at 65vh with a sticky header + internal scroll (`.table-scroll`).
  - Card pattern reserved for prose/definitional + stat-tile content; dense sortable data stays tabular.

## Static hosting
- `scripts/snapshot.ts` → `web/public/data.json` (all view models from the real engines).
- `web/src/api.ts` runtime mode: static (data.json) or server (/api). Views unchanged.
- `npm run web:static` = snapshot + build → `web/dist` (GitHub-Pages-ready, `base:"./"`).
- Mobile layout pass done (@media ≤760px).
- Pages live at **https://joshuablotter.github.io/SleeperGM/** (custom domain gotfomo.me removed; cname null).

### ⚠ Nightly deploy — NOT working yet (diagnosed 2026-08-07)
Root causes: (1) `refresh.yml` was **never pushed** to the default branch, so it isn't registered and
has never run — the only Action on GitHub is the built-in `pages-build-deployment` (fires on manual
`docs/` pushes). (2) Repo "Workflow permissions" default is **read-only**, and GITHUB_TOKEN pushes don't
reliably re-trigger the legacy `/docs` Pages build. **Fix applied locally:** rewrote `refresh.yml` to
GitHub's official Pages deploy (`configure-pages` + `upload-pages-artifact` + `deploy-pages`, one job,
no docs/ commit). **Still needs (user/one-time):** push the repo, and set **Settings → Pages → Source =
"GitHub Actions"** (was "Deploy from branch /docs"). After that, nightly + manual "Run workflow" deploy.

## M5 done (web)
- Orchestration lifted from `cli/src/lib.ts` → `core/src/app.ts` (shared by CLI + server).
- `server/` Express API (`/api/league|team/:id|inflation|trades/:id|rules`, `POST /refresh`).
- `web/` React + Vite SPA (Dashboard, Team w/ inflation toggle, Inflation, Trades). `npm run web` →
  http://localhost:3001. Verified rendering live data. 53 tests green; server type-checked.

## Done since M3
- **Inflation tracker** (`sgm inflation`, T27): rational keepers (surplus>0) → total keeper surplus
  ($855 live) → multiplier = (cap−salaries)/(cap−worth) ≈ **×2.0** on the real league. Shows top
  discount drivers + per-team surplus. Valuation calibration vs cap ≈ 0.98 (well-scaled).
- `keepers` now takes a positional `[team]` like `team` (bare = all teams).

## Blocked / waiting on the user
- **Keeper escalation formula** (spec §6.1) — faked as flat **+$5/yr** placeholder.
- **Rookie startup cost** (spec §6.4) — faked as flat **$3** placeholder.
- Both are marked `placeholder: true` in `config/league-rules.ts` and flagged by `sgm rulebook`.
  When the real rules doc lands: update that config + `docs/league-rules.md` only.

## How to verify quickly
```bash
npm install
npm run check      # must be green
npm run sgm -- dashboard   # lists the 12 real teams (needs network)
```

## Known gaps / simplifications (revisit later)
- **All house rules are now encoded — no placeholders remain.** §6.1 escalation (positional +
  years-kept for skill; +$1/yr for K/DEF), §6.4 rookie table (slot×position), and per-owner
  `yearsKept` that **resets on trade** (base salary still carries the original draft value).
- **Interpretation to confirm:** `yearsKept` counts from the season the *current owner* acquired the
  player through the upcoming season; rookies start escalating the year after draft. One-line change
  in `engines/keepers.ts` / `cli/src/lib.ts` if any boundary differs.
- Valuation is still a v1 VORP→$ heuristic (last-season points) — the one remaining approximation.
- Valuation is a v1 VORP→$ heuristic using last season's actual points as the projection proxy.
- Players with a pre-2022 (pre-Sleeper) origin and no priced event since would still show `unknown`;
  none currently do on the user's roster. `npm run sgm:trace -- "<name>"` diagnoses any that appear.

## Resolved this session
- **T24 (cost basis)** — `buildDraftIndex` now reads every draft/season (auctions + rookie `linear`);
  rookie picks dollarize by `(round, slot)`; trades carry original basis; re-acquire/FAAB reset.
  The user's roster resolves with **zero unknowns** (A.J. Brown → 2022 auction $1 carried through trade;
  McConkey 1.11; Achane 1.12). Added `npm run sgm:trace` debug tool.
