# League Brain (v3) — feature spec

> A "GM's scouting report" for the whole league, on the **Dashboard**. Reads the league and produces a
> **profile per team** (archetype + tendencies + a one-line scouting take) plus **league superlatives**
> ("awards") that answer the manager-behavior questions. Light humor, not a comedy act.
>
> Style/scope notes match the draft toolkit ([draft-toolkit.md](draft-toolkit.md)): one **pure** engine in
> `core/src/engines/`, orchestration glue in `app.ts`, mirrored on CLI + server + snapshot, surfaced in web.

## Motivation

The app already knows a lot about the league (rosters, salaries, worth, surplus, draft history, trades,
rookie capital) but never *characterizes* the managers. The League Brain turns that raw data into the
kind of thing you'd say at the draft table: "watch out, he always pays up at RB," "she's clearly
rebuilding," "that roster is worth a fortune but it's all bust-prone." It answers the user's questions:

- **Who hoards RBs?** — roster construction (position counts vs league average).
- **Who drafts QBs early?** — auction **spend share** by position (interpreted below).
- **Who consistently waits on TE?** — low TE spend share.
- **Who has the most draft capital?** — upcoming rookie picks owned (from the rookie board).
- **Who has the best keepers?** — total keeper **surplus** (cheap studs).
- **Who trades the most?** — completed trade transactions across the league's history.
- **Who has the most "valuable" roster?** — sum of player worth.
- **Who is rebuilding / who is a contender?** — a composite **contender index** + archetype.

### Interpretation calls (stated, not hidden)

This is an **auction** keeper league with a **1-round rookie draft**, so "drafts QBs early" has no literal
snake-draft meaning. We interpret **draft tendency = share of auction dollars spent by position**, pooled
across every auction season we can see (more seasons → steadier signal). "Pays up at QB" = high QB
dollar-share; "waits on TE" = low TE dollar-share. The UI says "spend tendency," and shows the confidence
(how much auction data backs it). We never present a tendency computed from one thin season as fact.

## Data (all already available)

| Signal | Source |
| --- | --- |
| Roster position counts | `ctx.registry` + `resolve()` |
| Roster value (Σ worth) | `teamSurplusBoard` (skill positions; K/DEF excluded) |
| Keeper surplus (Σ positive surplus) | `teamSurplusBoard` |
| Auction spend by position | draft picks (`amount` + `picked_by` + `resolve().position`), pooled over `chain` |
| Trade count | `transactions` where `type === "trade"`, per participating roster, over `chain` |
| Rookie draft capital | `loadRookieBoard().byTeam[].picks.length` |
| Last-season record | prev-season rosters' `settings.wins` (same source the rookie board uses) |
| Roster youth | `RawPlayer.years_exp` of rostered skill players (rebuild signal) |

One small client change: `RawTransaction` needs `roster_ids` (the parties on a transaction) so trades can
be attributed per team. Trades have no `adds`/`drops` fan-out we rely on here — `roster_ids` is the clean
key. Add it to the interface (read-only; no new endpoint).

## Engine — `core/src/engines/leagueBrain.ts` (PURE)

Takes fully-digested numeric inputs per team (no network, no resolver) and returns profiles + awards, so
it's trivially unit-testable. All league-relative math (averages, ranks, normalization) happens here.

```ts
export interface TeamBrainInput {
  rosterId: number;
  teamName: string;
  manager: string;
  lastSeasonWins: number;          // prior completed season (0 if unknown)
  rosterValue: number;             // Σ worth of skill players
  keeperSurplus: number;           // Σ positive surplus (cheap-stud value)
  posCounts: Record<string, number>;   // rostered skill players by position (QB/RB/WR/TE)
  spendByPos: Record<string, number>;  // auction $ spent by position, pooled across seasons
  tradeCount: number;              // completed trades across the chain
  rookiePicks: number;             // upcoming rookie picks owned
  avgYearsExp: number | null;      // mean years_exp of rostered skill players (youth = rebuild)
}

export interface TeamProfile extends TeamBrainInput {
  spendShare: Record<string, number>;  // spendByPos normalized to 0..1 (blank if no spend seen)
  contenderIndex: number;               // 0..100, league-relative
  archetype: "contender" | "win-now" | "balanced" | "retooling" | "rebuilding";
  tags: string[];                       // e.g. ["RB hoarder", "pays up at QB", "waits on TE"]
  scouting: string;                     // one witty line built from the strongest signals
}

export interface Superlative {
  id: string;          // stable key, e.g. "rb-hoarder"
  emoji: string;
  title: string;       // punny award name
  rosterId: number;
  teamName: string;
  manager: string;
  stat: string;        // the number behind it, e.g. "7 RBs", "38% of $ on QB"
  blurb: string;       // one slightly-funny sentence
}

export interface LeagueBrain {
  profiles: TeamProfile[];    // sorted by contenderIndex desc
  superlatives: Superlative[];
  generatedNote: string;      // e.g. "tendencies pooled over 3 auction seasons"
}

export function computeLeagueBrain(teams: TeamBrainInput[], opts: {
  spendSeasons: number;       // how many auction seasons fed spendByPos (confidence/among the note)
}): LeagueBrain;
```

### Contender index (0..100, league-relative)

Normalize each signal to 0..1 across the league (min-max), then weight. Chosen so it reflects *ready to
win now* rather than *good someday*:

- rosterValue — **0.30** (raw talent on hand)
- keeperSurplus — **0.30** (cheap studs = cap room to build a winner)
- lastSeasonWins — **0.25** (recent results)
- youth — **0.15**, but **split by archetype**: for the *contender* index, older-and-good reads win-now;
  we fold youth into archetype classification (below) rather than rewarding youth in the index. In the
  index we use `(1 − youthNorm)` at 0.15 so a veteran roster nudges the score up slightly (win-now urgency).

Index = round(100 × Σ weightᵢ·normᵢ). Degenerate leagues (all equal) → everyone ~50.

### Archetype

Rank teams by contenderIndex; combine with rebuild signals (rookie capital + youth):

- **contender** — top third of contenderIndex AND not a heavy rebuilder.
- **win-now** — top third, but old roster (high avgYearsExp) and/or has traded away rookie capital
  (rookiePicks below league median) — spending the future on the present.
- **rebuilding** — bottom third AND (young roster OR lots of rookie capital).
- **retooling** — bottom third but not clearly young/stocked (mediocre and stuck).
- **balanced** — middle third.

### Tags (tendencies)

Each is a league-relative threshold, so they self-calibrate:

- **RB hoarder / WR hoarder / etc.** — posCount ≥ league mean + 1.5 (and ≥ a floor, e.g. 5) at that position.
- **pays up at QB / RB / …** — spendShare[pos] is the league max at that pos AND ≥ mean + margin.
- **waits on TE / QB / …** — spendShare[pos] in the bottom quartile (with some league spend at that pos).
- **wheeler-dealer** — tradeCount in the top 2.
- **keeper hoard** — keeperSurplus in the top 3.
- **draft-capital baron** — rookiePicks ≥ mean + 1.

### Scouting line (slight humor)

Deterministic (no RNG — the workflow/runtime forbids `Math.random`): pick a template by the team's
**dominant tag** (or archetype if untagged) and fill in the number. A small template table per tag, e.g.:

- RB hoarder → "Rosters {n} running backs. The RB position called; it wants some back."
- pays up at QB → "Sinks {pct}% of auction cash into QBs — pays quarterback prices for quarterback feelings."
- waits on TE → "Would rather stream a tight end off the street than pay retail."
- rebuilding → "Firmly planted in the future — this roster is a group project due next year."
- contender → "Loaded and cheap. The rest of us should be nervous."

Keep it to **one** line each; humor should be a garnish.

## Superlatives (the awards)

One per user question; each is the arg-max (or min) team for a metric, skipped if no data:

| id | emoji | title | metric |
| --- | --- | --- | --- |
| `rb-hoarder` | 🏈 | The RB Hoarder | max posCounts.RB |
| `qb-spender` | 💸 | Pays Full Price at QB | max spendShare.QB |
| `te-streamer` | 😴 | Waits on TE | min spendShare.TE (some league TE spend) |
| `capital-baron` | 🎟️ | Draft-Capital Baron | max rookiePicks |
| `best-keepers` | 💎 | Best Keepers | max keeperSurplus |
| `wheeler-dealer` | 🔁 | Wheeler & Dealer | max tradeCount |
| `richest-roster` | 👑 | Most Valuable Roster | max rosterValue |
| `contender` | 🏆 | Prime Contender | max contenderIndex |
| `rebuild` | 🔧 | Deepest Rebuild | min contenderIndex (rebuild-leaning) |

## Orchestration — `loadLeagueBrain(ctx, data)` in `app.ts`

Value-dependent (rosterValue/keeperSurplus/contenderIndex use `data.values`), so it's baked **per source**
like tiers/scarcity/targets. Assembles the `TeamBrainInput[]`:

1. Per team, walk `teamSurplusBoard` → rosterValue (Σ worth, skill only), keeperSurplus (Σ positive
   surplus), posCounts (skill), avgYearsExp (from `RawPlayer.years_exp`).
2. `buildDraftSpend(ctx)` — pool auction `amount` by `picked_by`(owner) × position across `chain`
   (owner user_id is stable; map to current rosterId via the registry).
3. `buildTradeCounts(ctx)` — count `type==="trade"` completed transactions per roster across `chain`.
4. rookiePicks from `loadRookieBoard(ctx).byTeam`.
5. lastSeasonWins from prev-season rosters (reuse the rookie-board fetch pattern).
6. Call `computeLeagueBrain(...)`.

## Surfaces

- **CLI** `sgm brain` — prints superlatives then a one-line-per-team profile table.
- **Server** `GET /api/brain?source=` — returns `LeagueBrain` (value-aware via `dataForSource`).
- **Snapshot** — bake `bySource[src].brain`; web reads it via the source dropdown.
- **Web** — a **League Brain** section on the Dashboard: a row of award cards, then a grid of team
  profile cards (archetype pill + tags + scouting line + mini stat row), each opening the Team page.
  Mobile: award cards + profile cards already fit the `.deck`/`.card` pattern; single-column ≤760px.

## Testing (pure engine)

`core/src/__tests__/leagueBrain.test.ts` with hand-built `TeamBrainInput[]`:

- contenderIndex ranks a rich/cheap/winning team above a poor/expensive/losing one.
- archetype: a young + high-rookie-capital + low-index team → "rebuilding"; an old + high-index +
  low-capital team → "win-now".
- tags: an RB-heavy roster gets "RB hoarder"; a QB-spend-max team gets "pays up at QB"; a min-TE-spend
  team gets "waits on TE".
- superlatives: the arg-max team wins each award; awards with no data are omitted.
- humor line is present and references the driving number (no RNG; deterministic per input).

## Future ideas (answering "what else could make the brain more useful") — NOT in v3

Logged so they aren't lost; pick up later if wanted:

- **Roster volatility** — average player archetype (boom-bust share) per team, from the drilldown grades:
  "high-ceiling, high-variance" vs "steady floor." We already compute per-player archetypes.
- **Positional age cliffs** — RB age exposure (years_exp of the RB corps): flags a win-now team whose
  studs are about to fall off.
- **Cap health / flexibility** — committed keeper $ vs cap, and how much dry powder for the auction.
- **FAAB aggressiveness** — from the FAAB index (`buildFaabIndex`): who bids big on waivers.
- **Trade network** — who trades with whom (partners), not just counts — a mini rivalry map.
- **Regret index** — last year's auction buys that busted (we already have draft-value deltas per team).
- **Power ranking** — blend contenderIndex with record for an offseason power poll.
- **Trend over time** — is a manager trending up or down across seasons (value/record trajectory)?
```
