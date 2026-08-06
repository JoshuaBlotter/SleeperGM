# Sleeper GM — Flow & Interaction Diagrams (v0.1)

Companion to [spec.md](spec.md). These map how a user moves through the app and how the pieces talk to
each other. They are written to hold true for **both** the CLI (Phase 1) and the later web UI — the
"App" lane is whichever front-end is present; the **core engines** and **Sleeper API** lanes are
identical either way.

Rendered as Mermaid (GitHub / most Markdown viewers render these natively).

---

## 1. System interaction — data flow with caching

How any request flows from the user to Sleeper and back, and where caching short-circuits it.

```mermaid
sequenceDiagram
    actor U as User
    participant FE as App (CLI / Web)
    participant Core as Core engines
    participant Cache as Disk/Memory cache
    participant API as Sleeper API (read-only)

    U->>FE: run command / open page
    FE->>Core: request (e.g. getTeam rosterId)
    Core->>Cache: lookup (key + TTL)
    alt cache fresh
        Cache-->>Core: cached data
    else miss / stale
        Core->>API: GET /league, /rosters, /draft/picks, ...
        API-->>Core: JSON
        Core->>Cache: store with TTL
    end
    Core->>Core: resolve players, compute cost / worth / surplus
    Core-->>FE: view model (plain data)
    FE-->>U: dashboard / team / keeper board
    Note over U,API: No auth anywhere. Players DB cached 24h, league data 5-15 min.
```

---

## 2. Onboarding & team selection (the "team registry")

How the app learns the 12 teams once, so the user can then focus on a single team. This is the concrete
form of "gather and store team_ids as well as the league id."

```mermaid
flowchart TD
    A([Start]) --> B{LEAGUE_ID set?}
    B -- no --> B1[Read LEAGUE_ID from .env<br/>default 1389689313502961664] --> C
    B -- yes --> C{Team registry cached<br/>& fresh?}
    C -- yes --> G[Load registry from cache]
    C -- no --> D[GET /league/:id/users]
    D --> E[GET /league/:id/rosters]
    E --> F[Join users + rosters →<br/>Team = rosterId, owner, teamName, avatar]
    F --> F2[Cache registry TTL 15m]
    F2 --> G
    G --> H[Show team list:<br/>rosterId · teamName · record]
    H --> I{User picks a team?}
    I -- by name or rosterId --> J[Single-team view]
    I -- all --> K[League dashboard]
```

---

## 3. Keeper decision — swimlane

The central user journey: from picking a team to deciding who to keep, with cap and surplus in view.
Lanes = who does the work.

```mermaid
flowchart TB
    subgraph U[User]
        U1[Pick team]
        U2[Review keeper board]
        U3[Toggle a keeper set]
        U4[Decide keep / cut / hold]
    end
    subgraph APP[App CLI/Web]
        A1[Request team keepers]
        A2[Render board sorted by surplus]
        A3[Send simulate request]
        A4[Show cap used / available]
    end
    subgraph CORE[Core engines]
        C1[Build team from registry + roster]
        C2["Acquisition cost from draft $ / FAAB"]
        C3[yearsKept from history chain]
        C4["keeperCostNextYear = cost + escalation §6.1"]
        C5["Valuation → worth $ §7"]
        C6[surplus = worth − cost]
        C7["Cap sim vs $200 §6.5"]
    end
    subgraph EXT[Sleeper API + Rules config]
        E1[(rosters / draft picks / transactions)]
        E2[(previous_league_id history)]
        E3[("league-rules.ts §6")]
    end

    U1 --> A1 --> C1
    C1 --> E1
    C1 --> C2 --> E1
    C2 --> C3 --> E2
    C3 --> C4 --> E3
    C4 --> C5 --> C6
    C6 --> A2 --> U2
    U2 --> U3 --> A3 --> C7
    C7 --> E3
    C7 --> A4 --> U4
```

---

## 4. Trade exploration — swimlane

```mermaid
flowchart TB
    subgraph U[User]
        T1[Choose my team + a partner team]
        T2[Review suggested trades]
        T3[Inspect a candidate]
    end
    subgraph APP[App]
        P1[Request trade suggestions]
        P2[List trades ranked by my surplus gain]
        P3[Show before/after cap + surplus for both teams]
    end
    subgraph CORE[Core engines]
        R1[Load both rosters w/ cost + surplus]
        R2[Find needs: roster construction gaps]
        R3[Generate candidate swaps]
        R4["Score: Δ my surplus, Δ cap space, fairness"]
        R5[Filter cap-legal vs $200]
    end
    subgraph EXT[Sleeper API + Rules]
        X1[(rosters / traded_picks)]
        X2[(league-rules.ts)]
    end

    T1 --> P1 --> R1 --> X1
    R1 --> R2 --> R3 --> R4
    R4 --> R5 --> X2
    R5 --> P2 --> T2
    T2 --> T3 --> P3
```

---

## 5. Overall navigation map

The menu/nav the user moves through — identical concept for the CLI menu and the web nav.

```mermaid
flowchart LR
    Home[Home / Menu] --> Dash[League Dashboard<br/>sgm dashboard]
    Home --> Team[Single Team<br/>sgm team]
    Home --> Rules[Rulebook<br/>sgm rulebook]
    Home --> Keep[Keeper Board<br/>sgm keepers]
    Home --> Infl[Inflation Tracker<br/>sgm inflation]
    Home --> Trade[Trade Explorer<br/>sgm trades]

    Dash --> Team
    Team --> Keep
    Keep --> Sim[Cap Simulator<br/>sgm simulate]
    Team --> Trade
    Infl -. "adjusts $ used by" .-> Keep
    Infl -. "adjusts $ used by" .-> Trade
    Rules -. governs cost math in .-> Keep
    Rules -. governs cost math in .-> Trade
```

---

### Legend / conventions
- **App** lane = CLI in Phase 1, React later — same downstream flow.
- **Core engines** = pure, unit-tested functions ([spec.md §5](spec.md)).
- Dashed arrows = "influences/governs," solid = direct call/data flow.
- `❓` rules (escalation §6.1, rookie cost §6.4) plug in at the **Rules config** node; the flows already
  account for them so implementation isn't blocked on the numbers.
