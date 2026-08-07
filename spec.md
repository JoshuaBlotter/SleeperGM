# Sleeper GM — Spec (v0.2, draft for iteration)

A personal web app that connects to the **Sleeper** fantasy football API to help me manage my
dynasty/keeper league **"Los Socios"** (league id `1389689313502961664`): find value, choose keepers,
spot trades, track league-wide inflation, and keep my weird house rules straight.

> Status: **living spec.** All house rules are now confirmed and encoded (§6) — no placeholders remain.
> M0–M3 are built and verified against the live league; M4 (inflation/trades) and M5 (web) are next.

**Changelog v0.1 → v0.2**
- API confirmed **read-only, no login** anywhere in the app.
- Added a **team registry** so we can view **one team at a time** (store roster/owner/team-name).
- **CLI-first** build order: pure engines → console app to test logic early → React later.
- Locked house rules from my answers: waiver keeper cost = FAAB acquisition cost; cost **resets on
  re-acquire**; taxi/IR **count** against cap but their players are ~free.
- Added companion docs: **[diagrams.md](diagrams.md)** (interaction + swimlane flows) and
  **[tasks.md](tasks.md)** (AI-workable task breakdown).

---

## 1. Goals

1. **See my team and league clearly** — rosters, budgets, standings, matchups, in plain language,
   with the ability to **focus on a single team at a time**.
2. **Value engine** — estimate each player's on-field worth vs. their *cap cost* to keep → surplus.
3. **Keeper helper** — apply the league's price-escalation rules; show next-year cost and keep/cut/hold.
4. **Trade explorer** — compare rosters, surface trades that improve my value or cap flexibility.
5. **Inflation tracker** — quantify the annual auction inflation from cheap rookies, adjust valuations.
6. **League rulebook** — one readable page encoding our house rules (the ones Sleeper can't express).

**Build principle: test functionality early.** Logic ships as pure functions with unit tests and is
exercised through a **console app before any UI exists**. See §5, §11.

Non-goals (for now): live in-auction draft assistant, mobile-native app, multi-league support, and any
**write** access — the public Sleeper API is **read-only and needs no login**, and our app keeps it
that way (no accounts, no auth, no secrets).

---

## 2. What the Sleeper API gives us (verified against the real league)

Base URL: `https://api.sleeper.app/v1`. **Read-only, no auth, no API key.** Rate limit: stay under
~1000 calls/min. CORS is permissive, but we still want a backend/core layer for caching (see §5).

| Data | Endpoint | Notes / verified findings |
|---|---|---|
| League config | `/league/{league_id}` | `type: 2` (keeper), roster positions, `max_keepers: 20`, scoring (PPR, `rec:1`), `previous_league_id`. |
| League history | walk `previous_league_id` | 2026 → 2025 (`1181720941059506176`) → … multi-year price history. |
| Rosters | `/league/{id}/rosters` | players[], starters[], `taxi[]` (2 slots), `reserve[]` (IR, 2 slots), record, `roster_id`. |
| Members | `/league/{id}/users` | `user_id`, display name, `metadata.team_name` ("Blotter trotters", "EBITDAwgs"…). |
| Draft(s) | `/league/{id}/drafts`, `/draft/{draft_id}` | **Main draft = auction, `budget: 200`** = the cap. `minis_enabled` → rookie mini-drafts. |
| **Draft picks + prices** | `/draft/{draft_id}/picks` | Each pick has `metadata.amount` (auction $) + `is_keeper`. Verified: Hill $35, CMC $69, Kincaid $9. |
| Traded picks | `/league/{id}/traded_picks` | Future rookie-pick ownership (2026 picks already traded). |
| **Transactions / FAAB** | `/league/{id}/transactions/{week}` | trades, waivers, and **FAAB bid amounts** (`waiver_budget: 100`) — the source for a waiver-acquired player's keeper cost (§6.2). Per week. |
| Matchups | `/league/{id}/matchups/{week}` | weekly scores per roster → last-season actual points for the valuation model. |
| Players DB | `/players/nfl` | **~5 MB, all NFL players.** Fetch **once/day max**, cache. Maps `player_id` → name/pos/team. |
| Trending | `/players/nfl/trending/add` | most-added players (waiver signal). |
| Avatars | `https://sleepercdn.com/avatars/{id}` | team/user images (for the eventual UI). |
| NFL state | `/state/nfl` | current season/week. |

### The team registry (for single-team viewing)
The app builds and caches a small registry by joining `/users` + `/rosters`:

```
Team = { rosterId, ownerUserId, displayName, teamName, avatar }
```

`leagueId` is the app default (env). All single-team views are keyed by `rosterId` (1–12). This is what
your point about "gather and store team_ids as well as the league id" becomes concretely.

### The gap the API cannot fill ❓
Sleeper does **not** store our **keeper price-escalation formula** or the **cap cost of rookie picks**.
These are house rules, loaded from a versioned config (see §6). Still pending your rules doc.

---

## 3. Core concepts / domain model

```
League
 ├─ season, capBudget ($200 auction), rosterSlots, scoringSettings, maxKeepers
 └─ Team (roster)                       ← keyed by rosterId; single-team views use this
     ├─ owner (user), teamName
     ├─ capUsed / capAvailable          ← derived from keeper costs + rookie costs
     ├─ Players[]
     │   ├─ player_id, name, pos, nflTeam
     │   ├─ acquiredVia (auction | rookie mini | waiver/FAAB | trade)
     │   ├─ acquisitionCost              ← auction $, FAAB $, or rookie-pick cost
     │   ├─ yearsKept                    ← from history chain
     │   ├─ keeperCostNextYear           ← acquisitionCost + escalation (house rule)
     │   ├─ projectedValue ($)           ← on-field projection → auction-dollar model
     │   └─ surplus = projectedValue − keeperCostNextYear
     └─ DraftPicks[] (owned future rookie picks)
```

Two "values" per player:
- **Cost** — what they count against the cap next season (from house rules + history).
- **Worth** — projected auction value given production outlook (a model; §7).
- **Surplus = Worth − Cost.** Positive surplus = good keeper. This single number drives most of the app.

---

## 4. Features (phased)

### MVP (Phase 1) — "See it" *(console app)*
- **League dashboard:** 12 teams, records, cap used/available, roster snapshots.
- **Single-team view:** pick a team by name/rosterId; see its players with acquisition cost + years kept.
- **Rulebook:** render the house-rules config (§6) in plain English so numbers are auditable.
- **Player resolver + daily cache** of `/players/nfl`; **team registry** cache.

### Phase 2 — "Value it"
- **Valuation engine** (§7): projected worth ($) per player.
- **Keeper board:** every rostered player sorted by surplus; keep/cut/hold suggestion.
- **Cap simulator:** toggle keepers on/off; watch cap space update against $200.

### Phase 3 — "Work the market"
- **Inflation tracker** (§8).
- **Trade explorer:** compare two rosters; propose trades that raise my surplus / free cap.
- **Rookie pick valuator:** cost vs. expected surplus per mini pick.

### Later
- Weekly matchup/start-sit glance, waiver/FAAB trends, taxi-stash advice, historical what-ifs, CSV export,
  and the **React UI** over the same engines.

---

## 5. Architecture (CLI-first)

The valuation/keeper/inflation logic lives in a framework-agnostic **core** package of pure functions.
The **CLI** is the first consumer (fast to build, trivial to test by hand); a thin **HTTP server** and
**React** UI are added later as *additional* consumers of the exact same core. Nothing is rewritten.

```
                         ┌────────────────────────────┐
      Phase 1 ───────────►      core  (engines)        │◄─ pure, unit-tested
      (build first)      │  sleeper client + cache     │
                         │  team registry              │
                         │  history / cost / valuation │
                         │  keepers / inflation / trade │
                         └───────────┬─────────────────┘
                                     │ imported by
        ┌────────────────────────────┼───────────────────────────┐
        ▼                            ▼                             ▼
   ┌──────────┐   Phase 1     ┌──────────────┐  Later      ┌──────────────┐  Later
   │  CLI     │◄────build─────│              │             │  React (Vite)│
   │ console  │  first        │  Express API │────serves──►│  web SPA     │
   │  app     │               │  /api/*      │             │              │
   └──────────┘               └──────────────┘             └──────────────┘
                                     │
                                     ▼
                            Sleeper API (read-only) + disk cache
```

**Why this order:** it makes "test functionality early" the default — every engine is runnable from the
terminal the day it's written, long before UI concerns exist.

**Caching:** in-memory + on-disk JSON with TTLs — players DB 24h; league/rosters ~5–15 min; historical
drafts effectively permanent; team registry 15 min. A `refresh` command/flag force-busts.

---

## 6. House-rules config (ALL RESOLVED — no placeholders)

A single versioned file the core loads, `config/league-rules.ts`, validated with Zod. Full rules are
transcribed in [docs/league-rules.md](docs/league-rules.md) and rendered by `sgm rulebook`. Summary:

```ts
export const leagueRules = {
  capBudget: 200,                    // ✅ auction budget = salary cap (from API)
  maxKeepers: 20,                    // ✅ from API (effectively unlimited)

  // 6.1  ✅ new = old + increase, every offseason. Skill: positionalBase + yearsKept
  //      (QB 1, RB 6, WR 6, TE 3). K/DEF: flat +$1/yr.
  //      yearsKept is PER-OWNER and RESETS ON TRADE (base salary still carries original draft value).
  //      Computed from owner tenure (draft picked_by + transaction adds) in cli/src/lib.ts.
  keeperEscalation: {
    model: "positional",
    positionalBase: { QB: 1, RB: 6, WR: 6, TE: 3 },
    flatIncrease: 1, flatPositions: ["K", "DEF"],
  },

  // 6.2  ✅ Base cost for a player acquired off waivers = the FAAB $ spent to get him.
  waiverKeeperCost: { source: "faabBid" },   // read from transactions endpoint

  // 6.3  ✅ Cut & re-acquire RESETS cost to whatever it took to re-acquire him
  //      (new auction price, or new FAAB bid).
  resetCostOnReacquire: true,

  // 6.4  ✅ Rookie starting salary by draft slot (1-12) x position, then escalates like a vet.
  //      Full table in docs/league-rules.md (e.g. 1.01 RB $12; McConkey 1.11 WR $1; Achane 1.12 RB $1).
  rookieCost: { model: "table", /* slot -> {QB,RB,WR,TE} */ },

  // 6.6  ✅ Traded players CARRY their original draft basis (auction $ or rookie pick), which then
  //      escalates by years held. A trade does NOT reset cost (unlike waiver re-acquire, §6.3).
  tradeCarriesOriginalBasis: true,

  // 6.5  ✅ Taxi (2) and IR (2) slots are NOT exempt — they count against the cap,
  //      and their players are priced by the SAME rules as everyone else (no special
  //      discount). They just TEND to be cheap in practice: taxi = speculative/cheap
  //      rookies, IR = risky players. That's a tendency, not a rule — do NOT special-case it.
  taxiCountsAgainstCap: true,
  irCountsAgainstCap: true,
};
```

**Resolved from your answers**
- **§6.2** waiver-acquired players' keeper cost = their in-season **FAAB acquisition cost** (from
  `/transactions/{week}`).
- **§6.3** cutting then re-acquiring a player **resets** his cost to the new acquisition price.
- **§6.5** taxi + IR **count** against the cap and are priced by the **same rules as any other
  player** — no special discount. They merely *tend* to be cheap (taxi = speculative rookies, IR =
  risky players); that's a real-world tendency, not a pricing rule.
- **§6.1** keeper escalation (real): skill positions `old + positionalBase + yearsKept` (QB 1, RB 6,
  WR 6, TE 3); K/DEF `+$1/yr`. Applied annually → compounds over years kept.
- **§6.4** rookie starting salary (real): a **draft-slot × position** table (full table in
  docs/league-rules.md); escalates like a vet thereafter.
- **§6.6** traded players **carry their original draft basis** (auction $ or rookie pick), which then
  escalates — a trade does not reset cost. Verified: A.J. Brown carries his 2022 auction $1.

**All house rules are now resolved and encoded** in `config/league-rules.ts` + `docs/league-rules.md`,
rendered by `sgm rulebook`. One interpretation to confirm: escalation is replayed every year since
acquisition (a 2022 keeper has 4 increases in 2026; rookies start the year after draft).

---

## 7. Valuation engine (Phase 2)

Turns a player into a projected auction-dollar **worth**, so we can compute surplus.

- **Method:** rank players by projected fantasy points under *our* scoring (pulled from the API, not
  assumed), convert points-above-replacement → auction dollars scaled to the 12-team, $200 pool
  (VORP → \$).
- **Projection source (v1):** use **last season's actual points** (derived from `/matchups`) as a free,
  zero-dependency proxy. Swap in real projections later behind the same interface (CSV import, then an
  API) without touching consumers.
- **Output per player:** `projectedPoints`, `projectedValue$`, `replacementValue`, `surplus`.

---

## 8. Inflation model (Phase 3)

- **Measure:** per past auction, `total $ spent` vs. `total projected value` bought → inflation
  multiplier; break down by position and price tier.
- **Driver:** compare rookie cap cost (house rule) vs. rookies' realized value — the surplus rookies
  capture is the money pushed into veteran bidding.
- **Use:** adjust the valuation engine's \$ output by expected inflation so keeper decisions reflect what
  players will actually cost at auction.

---

## 9. Tech stack & project layout

- **Core/CLI (Phase 1):** Node + **TypeScript**. Native `fetch`/`undici` for Sleeper. Disk cache as JSON.
  **Zod** for config + response validation. CLI via a light framework (e.g. `commander` or a simple menu
  with `prompts`). **Vitest** for unit tests (engines are the priority to test).
- **Server (later):** **Express** exposing the core over `/api/*`.
- **Frontend (later):** React + **Vite** + TS, TanStack Query, Recharts, Tailwind.
- **Config:** `.env` for `LEAGUE_ID` (default `1389689313502961664`); `config/league-rules.ts` (§6).

```
sleeper-gm/
├─ spec.md · diagrams.md · tasks.md      ← planning docs
├─ package.json                          ← workspaces: core, cli, (server, web later)
├─ core/
│  ├─ src/
│  │  ├─ sleeper/        ← typed API client + cache
│  │  ├─ registry/       ← team registry (roster/owner/team-name)
│  │  ├─ history/        ← previous_league_id walker
│  │  ├─ engines/        ← valuation.ts · keepers.ts · inflation.ts · trades.ts (pure, tested)
│  │  ├─ config/league-rules.ts
│  │  └─ types.ts        ← shared domain types
│  └─ cache/             ← players-nfl.json, drafts, registry…
├─ cli/
│  └─ src/               ← commands: dashboard · team · rulebook · keepers · trades
├─ docs/league-rules.md  ← human-readable house rules (rendered by Rulebook later)
└─ (server/ · web/ added in later phases)
```

---

## 10. Interfaces

**CLI commands (Phase 1–3)** — mirror the eventual API so the port to web is mechanical:

| Command | Does |
|---|---|
| `sgm dashboard` | all 12 teams, records, cap summary |
| `sgm team <name\|rosterId>` | single-team view: players, acquisition cost, years kept |
| `sgm rulebook` | render resolved house rules |
| `sgm keepers [--team X]` | keeper board sorted by surplus |
| `sgm simulate --team X --keep a,b,c` | cap impact of a keeper set |
| `sgm inflation` | historical + projected inflation |
| `sgm trades --team X` | candidate trades |
| `sgm refresh` | force cache bust |

**HTTP API (later)** — 1:1 with the commands: `GET /api/league`, `/api/team/:rosterId`, `/api/keepers`,
`/api/keepers/simulate`, `/api/inflation`, `/api/trades`, `/api/rules`, `POST /api/refresh`.

---

## 11. Milestones (CLI-first)

1. **M0 – Scaffold & pipe** ✅ — monorepo, Sleeper client + cache, players + team registry, `dashboard`.
2. **M1 – History & cost** ✅ — chain walk; auction + FAAB costs; provenance; `team`.
3. **M2 – House rules & keeper cost** ✅ — §6 encoded (real rules), `keeperCostNextYear`, cap, `rulebook`.
4. **M3 – Valuation** ✅ — VORP→$ model, surplus, `keepers` + `simulate`.
5. **M4 – Market** ✅ — inflation, trade explorer (mutual-fit + sharky). *(rookie-pick valuator → M6.)*
6. **M5 – Web** ✅ — Express API + React/Vite UI; static GitHub Pages build (snapshot); mobile pass;
   **deployed** at `joshuablotter.github.io/SleeperGM/` with a nightly refresh Action.

**Shipped v1.** Full arc M0–M5 done: CLI + web on shared, tested engines with the real league rules and
the commissioner's salary sheet. Post-v1 work is tracked in §13.

---

## 12. Post-v1 roadmap (open GitHub issues)

These are speced in §13. Milestones continue:

7. **M6 – Rookie draft prep** (issue #1) — see §13.1.
8. **M7 – Data page = raw data** (issue #2 thread / item) — see §13.2.
9. **M8 – Pluggable value sources** (issue #2) — see §13.3. *The big one; replaces sole reliance on VORP.*

---

## 13. Post-v1 specs

### 13.1 Rookie draft prep (M6 · issue #1)
**Problem:** no way to see the incoming rookie draft — who picks when, what each pick costs.

**FR**
- FR1 Show the **rookie draft board** for the upcoming season: an ordered list of `round.slot` → owning team.
- FR2 Resolve **traded picks** (`/league/{id}/traded_picks`) so a pick shows its *current* owner, and note who it came from.
- FR3 Show each slot's **rookie salary** from the §6.4 table (by round+slot × position is player-dependent, so show the slot's baseline per position, or the flat slot cost).
- FR4 Summarize **per team**: which rookie picks they own (their draft capital).
- FR5 CLI `sgm rookies` + a web **Rookies** tab.

**AC**
- Given 2026 traded picks, a pick that was dealt shows the new owner and “via <old team>”.
- The board lists all rounds×12 slots in order with the owning team.
- Numbers reconcile with Sleeper's traded-picks data.

**Open (needs the user):**
- Base order (**confirmed**): use **Sleeper's draft order if the API exposes it** (a 2026 rookie/linear
  draft's `draft_order` / `slot_to_roster_id`); otherwise derive **reverse of 2025 final standings** and
  apply `traded_picks`. Investigate which is available.
- How many rounds does the rookie draft have?
- Scope: just the **ownership/order board + costs**, or also project **which rookies** land where (needs a rookie ranking/ADP source — overlaps M8)?

### 13.2 Data page = raw data (M7 · quick)
**Problem:** the Data page mixes analysis (worth/surplus/call) into what should be raw facts.

**FR / AC** (fully specified — no open questions)
- Remove the **Worth**, **Surplus**, and **Call** columns.
- Add an **NFL team** column.
- Add a **filter by NFL team** (alongside existing team/position/search).
- Keep: league team, player, pos, via, season, base $, years kept, keep $, source marker. Sort still works.
- Applies to the web Data page (and, if kept, the raw shape stays available via `/api/players`).

### 13.3 Pluggable value sources (M8 · issue #2)
**Problem:** the VORP→$ model is directionally OK but individually unreliable (e.g. Ja’Marr Chase / Kenneth Walker / Joe Burrow mis-valued). “Worth” drives keeper surplus, inflation, and trades — so bad values poison everything downstream.

**Goal:** make **worth** come from a **selectable value provider**, not just VORP. Support importing external auction-value lists (FantasyPros calculator, DraftSharks, FootballGuys, ADP-derived) and manual per-player overrides. The engines that consume `worth` don’t change — only where `worth` comes from.

**FR**
- FR1 A **value provider** abstraction: `playerId → value ($)`. Multiple named providers.
- FR2 Providers:
  - `vorp` — the current computed model (kept as a baseline/fallback).
  - `sheet:<name>` — an **imported CSV** of auction values (e.g. `config/values/fantasypros.csv`).
  - `manual` — per-player overrides that win over everything.
- FR3 **Import**: a CSV with `player_name` (and optional `position`,`team`,`value`) → matched to Sleeper `player_id` (fuzzy name match with a position/team tiebreak); report unmatched rows.
- FR4 **Selection**: choose the active provider (config + web selector). Optionally **blend** (average of chosen providers).
- FR5 **Override**: `config/values/overrides.csv` (`player_id|name → value`) always wins; editable in-app later.
- FR6 Scale imported values to the league (12 teams × $200) if a source is for different settings (or import pre-scaled from a calculator set to our settings — preferred).
- FR7 Surface the **active source** in the UI, and let unmatched/unknown players fall back to `vorp` (or $1).

**AC**
- With `fantasypros.csv` imported and selected, a team’s keeper board `worth` matches the imported values (spot-check Chase, Walker, Burrow look sane).
- Switching provider re-derives worth/surplus/inflation/trades consistently everywhere.
- An override for a player is reflected regardless of the selected source.
- Unmatched import rows are listed so the user can fix names.

**Decisions (confirmed):** ship **several pre-scraped static source CSVs** in `config/values/`
(FantasyPros, DraftSharks, FootballGuys, ADP-derived — scraped once at build time, committed as data,
not fetched live) **+ custom CSV import + manual per-player overrides**. **One active source** at a time
(config/UI selectable); **overrides always win**. VORP stays as a built-in fallback source.

**Design notes**
- Mirrors the salary-sheet pattern (`config/salaries.csv`): value CSVs live in `config/values/`, parsed by a pure function, matched to ids via the players resolver. `loadValues` in `core/app.ts` becomes provider-driven instead of always VORP. The snapshot/`data.json` bakes in whichever provider is active at build time.
- Name→id matching is the main risk; reuse the players DB, normalize (lowercase, strip Jr./III/punctuation), tiebreak by position+team, and always emit an “unmatched” report.
