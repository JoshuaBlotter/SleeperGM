# Sleeper GM — Task Breakdown (v0.1)

Companion to [spec.md](spec.md) and [diagrams.md](diagrams.md). Each task is written to be
**independently implementable**: a future agent should be able to open one task, read only what it
references, and complete it without reconstructing this conversation.

**Conventions**
- `ID` — stable reference (e.g. T02). `Blocks` / `Blocked by` — dependency links.
- **Status:** `ready` · `blocked` (waiting on a rules answer) · `later` (out of current phase).
- Every code task's Definition of Done includes: TypeScript compiles, **Vitest unit tests pass**, and
  the behavior is runnable from the terminal (per the CLI-first principle, spec §5/§11).
- League id default: `1389689313502961664`. All Sleeper endpoints: [spec.md §2](spec.md).

Legend: 🟢 ready 🔴 blocked 🕒 later

---

## Milestone M0 — Scaffold & pipe

### 🟢 T01 — Monorepo scaffold
- **Goal:** workspace skeleton the rest builds on.
- **Deliverables:** `package.json` with workspaces `core`, `cli` (server/web deferred); root `tsconfig`;
  Vitest configured; `.env.example` with `LEAGUE_ID`; `core/src/types.ts` stub for domain types (§3).
- **DoD:** `npm install` clean; `npm test` runs (even if 0 tests); `npm run build` compiles empty core.
- **Blocks:** everything.

### 🟢 T02 — Sleeper API client + cache layer
- **Goal:** one typed place that talks to Sleeper, with TTL caching.
- **Deliverables:** `core/src/sleeper/client.ts` wrapping the endpoints in [spec.md §2](spec.md)
  (`getLeague`, `getRosters`, `getUsers`, `getDrafts`, `getDraftPicks`, `getTransactions`,
  `getMatchups`, `getTradedPicks`, `getNflState`, `getPlayers`, `getTrending`). Disk+memory JSON cache
  with per-key TTLs (players 24h; league/rosters 5–15m; historical drafts permanent). `refresh()` bust.
- **DoD:** unit tests with mocked fetch verify cache hit/miss/expiry; a live smoke test fetches the real
  league and prints its name ("Los Socios").
- **Blocked by:** T01. **Blocks:** T03, T04, T06, all data tasks.

### 🟢 T03 — Players DB cache + resolver
- **Goal:** map `player_id` → name/pos/team without re-downloading 5 MB.
- **Deliverables:** `core/src/sleeper/players.ts` — daily-cached `/players/nfl`; `resolve(id)` and
  batch resolve; handles team codes (`SF`, `DAL`) for DEF.
- **DoD:** test resolves known ids (e.g. `4034`→ Christian McCaffrey) from a fixture; refuses network
  hit when cache fresh.
- **Blocked by:** T02.

### 🟢 T04 — Team registry
- **Goal:** enable single-team viewing (spec §2 registry; [diagrams.md §2](diagrams.md)).
- **Deliverables:** `core/src/registry/teams.ts` — join `/users` + `/rosters` →
  `Team = {rosterId, ownerUserId, displayName, teamName, avatar}`; cache 15m; lookup by `rosterId` or
  fuzzy `teamName`.
- **DoD:** test builds 12 teams from fixtures; `findTeam("EBITDAwgs")` and `findTeam(2)` resolve.
- **Blocked by:** T02.

### 🟢 T05 — CLI skeleton + `dashboard`
- **Goal:** prove the pipe end-to-end in the terminal.
- **Deliverables:** `cli/src` entry with command routing (`commander` or menu); `sgm dashboard` prints
  all 12 teams: rosterId, teamName, W-L record. `sgm refresh` busts cache.
- **DoD:** running `sgm dashboard` against the live league prints 12 real teams.
- **Blocked by:** T02, T04. **Delivers:** M0 milestone.

---

## Milestone M1 — History & cost

### 🟢 T06 — League history walker
- **Goal:** traverse seasons for price history.
- **Deliverables:** `core/src/history/chain.ts` — follow `previous_league_id` from 2026 back to the
  first season; return ordered `[{season, leagueId, draftId}]`. Verified chain start: 2026
  `1389689313502961664` → 2025 `1181720941059506176`.
- **DoD:** test walks a 2-season fixture; live run lists ≥2 seasons.
- **Blocked by:** T02.

### 🟢 T07 — Auction price extractor
- **Goal:** know what every player cost at auction, per season.
- **Deliverables:** `core/src/history/prices.ts` — from `/draft/{id}/picks`, map
  `player_id → {season, amount, isKeeper}` using `metadata.amount`. Verified: Hill $35, CMC $69,
  Kincaid $9.
- **DoD:** test parses a picks fixture into a price map; amounts are numbers.
- **Blocked by:** T02, T06.

### 🟢 T08 — FAAB / waiver acquisition-cost extractor
- **Goal:** base keeper cost for players grabbed off the wire (rule §6.2).
- **Deliverables:** `core/src/history/waivers.ts` — from `/transactions/{week}` (all weeks), extract
  successful waiver adds with their **FAAB bid** → `player_id → {season, faab}`. Handle free adds ($0).
- **DoD:** test parses a transactions fixture; a known FAAB add returns its bid amount.
- **Blocked by:** T02, T06.

### 🟢 T09 — Player provenance & yearsKept builder
- **Goal:** unify how each rostered player was acquired and for how long.
- **Deliverables:** `core/src/history/provenance.ts` — for a roster, per player compute
  `{acquiredVia, acquisitionCost, yearsKept}` by combining T07 (auction), T08 (FAAB), and the history
  chain (T06). Rule §6.3: re-acquire resets cost to the latest acquisition.
- **DoD:** unit tests cover auction-kept, waiver-add, and cut-then-re-bought (cost resets) cases.
- **Blocked by:** T07, T08.

### 🟢 T10 — CLI `team` (single-team view)
- **Goal:** the single-team experience ([diagrams.md §2](diagrams.md)).
- **Deliverables:** `sgm team <name|rosterId>` — list players with pos, acquisition cost, acquiredVia,
  yearsKept; sorted sensibly.
- **DoD:** live run for my team prints a coherent roster with costs. **Delivers:** M1.
- **Blocked by:** T04, T09.

---

## Milestone M2 — House rules & keeper cost

### 🟢 T11 — House-rules config + schema
- **Goal:** one validated home for house rules (spec §6).
- **Deliverables:** `core/src/config/league-rules.ts` + Zod schema; `docs/league-rules.md` human-readable
  source. Encode the **resolved** rules now: §6.2 FAAB base cost, §6.3 reset-on-reacquire, §6.5 taxi/IR
  count against cap and are priced identically to any player (no special case), `capBudget: 200`,
  `maxKeepers: 20`. Leave §6.1 escalation and §6.4 rookie cost as
  clearly-marked `TBD` stubs.
- **DoD:** schema rejects malformed config; resolved rules load; test asserts defaults.
- **Blocked by:** T01. *(Not blocked — the TBD parts are stubs.)*

### 🔴 T12 — Keeper cost engine
- **Goal:** compute `keeperCostNextYear` for any player.
- **Deliverables:** `core/src/engines/keepers.ts` — apply escalation (§6.1) to auction-kept players,
  FAAB base (§6.2) to waiver players, reset logic (§6.3). Pure function of provenance (T09) + rules (T11).
- **Blocked by:** **§6.1 escalation rule (rules doc)**, T09, T11. Interface can be built with a
  placeholder escalation and unit-tested against it; final numbers land with the rules doc.
- **Note:** structure so swapping the escalation model is a one-line config change.

### 🔴 T13 — Cap computation
- **Goal:** cap used/available per team vs. $200 (§6.5).
- **Deliverables:** `core/src/engines/cap.ts` — sum keeper costs (incl. taxi/IR, near-free) → capUsed;
  capAvailable = 200 − capUsed.
- **Blocked by:** T12 (and thus §6.1). **Also needs §6.4** once rookie picks are on rosters.

### 🟢 T14 — CLI `rulebook` + cost display
- **Goal:** make the rules and per-player cost auditable in the terminal.
- **Deliverables:** `sgm rulebook` renders `docs/league-rules.md` state; extend `sgm team` to show
  `keeperCostNextYear` and a team cap summary.
- **DoD:** rulebook prints resolved rules and flags TBD items; team view shows costs once T12/T13 land.
- **Blocked by:** T11 (rulebook part ready now); T12, T13 (cost columns). **Delivers:** M2.

---

## Milestone M3 — Valuation & keeper board

### 🟢 T15 — Scoring-aware points model
- **Goal:** last-season actual fantasy points per player, under *our* scoring.
- **Deliverables:** `core/src/engines/points.ts` — from `/matchups` (all weeks, prior season) sum points
  per player; respect league `scoring_settings` (PPR `rec:1`, etc.) from the API.
- **DoD:** test totals match a matchup fixture; scoring pulled from config, not hardcoded.
- **Blocked by:** T02, T06.

### 🟢 T16 — Valuation engine (VORP → $)
- **Goal:** projected auction **worth** per player (spec §7).
- **Deliverables:** `core/src/engines/valuation.ts` — points-above-replacement by position → dollars
  scaled to 12×$200 pool. Projection input behind an interface (v1 = T15 last-season points).
- **DoD:** test on a fixture yields sane $ ordering (studs > replacement); values sum ≈ pool.
- **Blocked by:** T15.

### 🔴 T17 — Surplus + CLI `keepers` board
- **Goal:** the payoff view — every player by surplus.
- **Deliverables:** `surplus = worth − keeperCostNextYear`; `sgm keepers [--team X]` sorted table with
  keep/cut/hold hint.
- **Blocked by:** T16 (worth) and T12 (cost → §6.1).

### 🔴 T18 — Keeper-set simulator
- **Goal:** try a keeper set, see cap impact.
- **Deliverables:** `sgm simulate --team X --keep a,b,c` → capUsed/available + total surplus of the set.
- **Blocked by:** T13, T17. **Delivers:** M3.

---

## Milestone M4 — Market

### 🔴 T19 — Inflation tracker
- **Deliverables:** `core/src/engines/inflation.ts` (spec §8) — per past auction, $ spent vs. value
  bought → multiplier by position/tier; feed back into valuation. `sgm inflation`.
- **Blocked by:** T07, T16. **Also uses §6.4** for the rookie-driver breakdown.

### 🔴 T20 — Trade explorer
- **Deliverables:** `core/src/engines/trades.ts` ([diagrams.md §4](diagrams.md)) — needs detection,
  candidate generation, scoring by Δsurplus/Δcap, cap-legality filter. `sgm trades --team X`.
- **Blocked by:** T16, T17, T13.

### 🔴 T21 — Rookie-pick valuator
- **Deliverables:** cost (§6.4) vs. expected surplus per mini pick, using `traded_picks` ownership.
- **Blocked by:** **§6.4 rookie cost rule**, T16, T19. **Delivers:** M4.

---

## Milestone M5 — Web (later)

### 🕒 T22 — Express API over core
- Expose the CLI command set 1:1 as `/api/*` (spec §10). Thin controllers; all logic stays in core.

### 🕒 T23 — React (Vite) UI
- Pages: Dashboard, Single Team, Rulebook, Keeper Board, Cap Simulator, Inflation, Trades
  ([diagrams.md §5](diagrams.md)). TanStack Query + Recharts + Tailwind. Consumes `/api/*` only.

---

## Follow-ups discovered during the build

### 🟢 T24 — Cost basis for trade-acquired & long-held keepers
- **Problem:** provenance only reads auction picks + FAAB adds, so trade-acquired players and players
  kept so long they never re-enter a draft show `unknown` cost → $1 keeper-cost floor → they look like
  fake bargains at the top of the keeper board. Confirmed on the real roster (A.J. Brown, Hurts,
  Achane); the season chain already reaches 2022, so it is NOT a depth problem.
- **Options:** (a) trace `transactions` trades to inherit the sender's cost basis across seasons;
  (b) use Sleeper's declared keeper values once the 2026 keeper deadline passes (roster `keepers` +
  upcoming-draft `is_keeper` picks carry amounts); (c) manual override map in config for known cases.
- **DoD:** traded/long-held players resolve to a real cost (or an explicit, non-$1 "manual needed"),
  and the keeper board stops surfacing $1 phantoms. Add unit tests for a trade-inherited cost.
- **Blocked by:** none (T09 exists). Recommended before trusting the keeper board.

## What's blocked on the rules doc
Only these need your **§6.1 escalation** and **§6.4 rookie cost** answers: **T12, T13, T17, T18, T19,
T21** (and their numbers, not their structure — interfaces can be built and unit-tested against
placeholder rules first). **Everything in M0–M1, plus T11/T14-rulebook/T15/T16, is buildable today.**

## Suggested first sprint (no rules needed)
`T01 → T02 → T03 → T04 → T05` (a working `sgm dashboard` of the real league), then
`T06 → T07 → T08 → T09 → T10` (single-team view with real acquisition costs).
