# Sleeper GM

A personal CLI (web later) for managing my Sleeper keeper/dynasty league **"Los Socios"** — keepers,
player value, trades, and league-wide auction inflation.

- **Plan:** [spec.md](spec.md) · **Flows:** [diagrams.md](diagrams.md) · **Backlog:** [tasks.md](tasks.md)
- **Working agreement:** [CLAUDE.md](CLAUDE.md) · **State:** [PROGRESS.md](PROGRESS.md) · **Decisions:** [DECISIONS.md](DECISIONS.md)

## Quick start
```bash
npm install
cp .env.example .env        # optional; defaults to league "Los Socios"
npm run check               # typecheck + tests (offline)
npm run sgm -- dashboard    # list the 12 teams (needs network)
```

## Web app (M5)
An Express API (`server/`) exposes the same core engines over `/api/*`; a React + Vite app (`web/`)
consumes them.
```bash
# one-shot: build the UI and serve UI + API on one port
npm run web                 # http://localhost:3001

# live dev (two terminals): API on 3001, Vite UI on 5173 (proxies /api)
npm run server
npm run web:dev

# static build for free hosting (GitHub Pages) — no server needed
npm run web:static   # snapshot Sleeper data -> data.json, then build web/dist
```
The app has two modes, decided at runtime: if a prebuilt `data.json` is present (static build) it reads
that; otherwise it calls the live `/api/*` server. See **[web/DEPLOY.md](web/DEPLOY.md)** for GitHub Pages
steps. The static site is a **snapshot** — re-run `npm run web:static` to refresh it.
A header **value-source dropdown** (shown when more than one source exists) switches the player-value
source everywhere — worth, surplus, inflation, and trades all recompute. On the static build this is
client-side (the snapshot bakes each source under `data.json → bySource`); on the server it's the
`?source=` query param.

Views: **Dashboard**, **Team** (keeper board with an interactive keeper-simulation — check rows to see
live cap/surplus — plus an inflation-adjusted toggle), **Inflation**, **Trades** (partner selector +
mutual-fit/sharky toggle), **Market** (Inflation · **Scarcity** = per-position kept-vs-available ·
**Last-year auction** = 2025 cost vs 2026 worth), **Rookies** (draft board — order, pick ownership, slot
cost, capital, prospects), **Players** (All = rostered + relevant free agents; Trending = most-added last
24h), **Rules** (rulebook + value glossary). Click any player name for a **drilldown** (weekly scores,
consistency grade, archetype).
API: `/api/league`, `/api/team/:id`, `/api/players`, `/api/trending`, `/api/player-details`, `/api/inflation`,
`/api/scarcity`, `/api/draft-value`, `/api/trades/:id`, `/api/rookies`, `/api/rules`, `POST /api/refresh`
(value-dependent routes accept `?source=<name>`).

## Commands
| Command | What |
|---|---|
| `npm run sgm -- dashboard` | all 12 teams, records, cap summary |
| `npm run sgm -- team <name\|rosterId>` | one team: players, acquisition cost, years kept |
| `npm run sgm -- rulebook` | resolved house rules (flags the two outstanding ones) |
| `npm run sgm -- keepers [team] [--inflated]` | keeper board by surplus; `--inflated` = market-adjusted worth |
| `npm run sgm -- inflation` | league auction inflation from keeper surplus |
| `npm run sgm -- values [--team X]` | active value source, coverage, unmatched players |
| `npm run values:adp` | refresh ADP-derived auction values → config/values/adp.csv |
| `npm run sgm -- trades <team> [--partner X] [--sharky]` | chips, targets, mutual-fit swaps (`--sharky` = surplus-max) |
| `npm run sgm -- rookies` | rookie draft board: derived order, pick ownership (traded picks), slot cost, draft capital |
| `npm run sgm -- draft-value` | last year's auction buys vs this year's projected worth (historical draft value) |
| `npm run sgm -- scarcity` | positional scarcity: how much of each position's top tier is kept vs available |
| `npm run sgm -- simulate --team X --keep a,b,c` | cap impact of a keeper set |
| `npm run sgm -- refresh` | clear the API cache |

## Authoritative salary sheet
Salaries for traded / long-held (pre-2022) players can't be fully reconstructed from the API and show
`≈` in `sgm team`. To make them exact, the app reads the league's salary sheet:
- **`config/salaries.csv`** (preferred) — derived from the commissioner's workbook. Columns:
  `season, player_id, player_name, position, nfl_team, manager, status, old_salary, years_kept,
  salary_increase, new_salary`. `new_salary` is the salary for `season`; the app escalates it forward
  to the upcoming keeper season using `years_kept`.
- `config/salaries.json` (fallback) — see `config/salaries.example.json`.

Sheet-sourced salaries show a `†`. The current `salaries.csv` is Season **2025** (163 players); the app
escalates one year to project **2026** keeper costs.

## Notes
- The Sleeper API is **read-only and needs no login**; this tool never writes.
- Two house rules are **not yet known** (keeper price escalation, rookie startup cost) and are **faked
  behind placeholders** — see the OUTSTANDING banner in `sgm rulebook`.
