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
1. **Confirm rookie-draft round count** — `rookieDraft.rounds` defaults to 1 (only round with a known
   §6.4 cost table); bump it in `league-rules.ts` once confirmed (snake order + traded-pick logic already
   generalize to N rounds; later-round costs show "—" until a table exists).
2. **Fix the nightly deploy** (see "Static hosting" below) — needs a push + one Pages setting flip.
3. Optional: fill the other import slots (cbs/draftsharks/footballguys); tune ADP→$ tau.

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
- **Data page tweak** (2026-08-07): columns reordered to Player · Pos · NFL · Fantasy team · Last pts ·
  In league · Base $ · Keep $ · Src (name first; fantasy team kept but demoted).

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
