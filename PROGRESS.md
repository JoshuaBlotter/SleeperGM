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
1. Deploy the static build to the user's GitHub Pages (see web/DEPLOY.md) — `npm run web:static`.
2. Optional: nightly GitHub Action to auto-refresh data.json.
3. Rookie-pick valuator (uses traded_picks).

## Static hosting (done)
- `scripts/snapshot.ts` → `web/public/data.json` (all view models from the real engines).
- `web/src/api.ts` runtime mode: static (data.json) or server (/api). Views unchanged.
- `npm run web:static` = snapshot + build → `web/dist` (GitHub-Pages-ready, `base:"./"`).
- Mobile layout pass done (@media ≤760px).

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
