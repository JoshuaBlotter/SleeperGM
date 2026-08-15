# DECISIONS — append-only log

Non-obvious choices and their rationale, so we don't re-litigate them. Newest at top.

## 2026-08-15 — New value source: ESPN Live Draft Trends (`espn-trends`)

- **A second, distinct ESPN source — not a replacement.** `espn.csv` is ESPN's *published estimate*
  off the kona endpoint; `espn-trends.csv` is the **AVG SALARY** column of ESPN's public "Live Draft
  Trends" page — what players are *actually* going for in live auctions. Different data, own file, so
  the user can compare estimate vs. market.
- **Kept RAW, not rescaled** (unlike `espn.ts`). ESPN's live auctions already run a $200 budget, the
  same as ours, and the site's **inflation checkbox** is what scales a source for our league — so
  rescaling here would double-count. The AVG SALARY dollars are used as-is, rounded to whole dollars
  with a $1 floor. (First cut rescaled to the pool; the user corrected it — the market number is the
  point of this source.)
- **Parsed structurally from the end, not the start.** The trends table only exists as a rendered
  copy-paste, and it's noisy: the player name repeats (once concatenated, once clean), an injury tag
  (`Q`/`O`/…) sometimes sits between name and team, defenses read `Texans D/ST`, team codes use ESPN's
  `WSH`. But every numeric stat carries a decimal or `+/-` sign, so **only rank lines match `/^\d+$/`** —
  that bounds each record for free (and skips the column-header block above rank 1). Within a record the
  tail is a fixed shape (`… NAME [INJURY?] TEAM POS AVGPICK d7 AVGSALARY d7 %ROST`), so team/pos/salary
  are read as fixed offsets from the record's *end*, immune to how many name lines the paste produced.
  Logic + test live in `core/src/values/espnTrends.ts`; `scripts/build-espn-trends.ts` is IO only.
- **$0 salary = undrafted, so left out** (mirrors `espn.ts`): a player nobody bids on isn't a $0 to
  rank. 250 pasted rows → 215 priced players, 0 unmatched against Sleeper.

## 2026-08-13 — Issues #18/#19/#20/#21: the value board is the SOURCE's board, and salaries show their work

- **A value board only shows players the active source ranks.** #18 is right that "top 12 at the
  position" is worthless if it isn't the source's top 12. It wasn't: an imported list covers ~250
  players, and everyone else kept a **VORP** dollar — which prices *last season's realized points*,
  not this season's market. Those are different axes, so an unranked blocking tight end with a good
  2025 outranked George Kittle. `ValueLine.ranked` now records which of the two produced a number,
  and tiers/scarcity/targets use only ranked players. Unranked players **keep their VORP worth**
  everywhere else — the Team page needs a dollar for every rostered player, and $1-ing a stud the
  source happens to omit would be worse than the bug. Rescaling VORP onto the source's scale was the
  other option and was rejected: it fixes the units and not the disagreement, which is the actual
  problem.
- **The ADP→dollars curve is fitted to ESPN's real auction values, not guessed.** The old
  `exp(-i/22)` charged **$100** for the #1 pick out of a $200 budget and flattened 139 of 256
  players to $1 — half the draftable board tied, ordered by nothing. ESPN publishes an actual
  auction value per player, and its curve has a **flat head** ($57 at #1, $48 at #11) and then a
  hard collapse ($2 by #101), which no plain exponential fits. A stretched exponential,
  `exp(-(i/tau)^1.33)` with `tau = 0.225 × draftable`, reproduces it to within ~$1 at every tenth
  rank. Ties then break on last season's points (`engines/board.ts`) — the only other fact the board
  has, and better than the Sleeper-id order that was deciding it before.
- **ESPN is a generated source, so it's rescaled; the paste-in slots aren't.** `espn.csv` comes from
  ESPN's stock 10-team/$200 league, so its values sum to $2000 and are scaled to our $2400 — same
  treatment `adp.csv` gets, because both are generated and can be recalibrated honestly. Players
  ESPN prices at **$0 are dropped rather than kept at $0**: a $0 is ESPN saying "not on the board",
  which is a reason to leave someone out, not a rank to sort.
- **The salary ladder and the keeper cost are one replay, not two.** #19/#20 both need the
  season-by-season salary chain, and the danger with a second implementation is that the ledger a
  manager reads stops matching the cost the cap engine charges. So `accumulatedSalary` is now the
  last row of `salarySchedule`, `teamKeeperLines` takes its cost from `salaryLadder`, and both read
  the same tenure/anchor inputs from one `salaryInputs`. Verified against the previous snapshot:
  204 rostered players, zero cost changes, and every ladder ends on the charged salary.
- **A year the sheet contradicts is marked, not smoothed.** For a sheet-anchored player the replayed
  years *before* the anchor often don't reach the sheet's number (A.J. Brown replays to $23 for 2025;
  the sheet says $36). Those rows carry `≈` and the sheet still wins from its season on. Hiding them
  would leave a manager with a $1 origin and a $36 salary and no account of the gap; showing them
  unmarked would pass a reconstruction off as the league's books.

## 2026-08-12 — Issue #15: adding color back without adding emoji

The issue is right that the redesign drained the app of personality, and right that emoji would read
as machine output. Three judgement calls came out of that:

- **The favicon is hand-drawn SVG, not a generated image.** The issue suggests an image generator.
  A generated raster would be a binary blob nobody can adjust, in a repo whose whole design layer is
  four color roles and a token scale. Twelve lines of SVG give a mark that is sharp at 16px and at
  512px, weighs 600 bytes, and is the *same file* the header renders — so the tab icon and the
  in-app mark cannot drift. Its four colors are literal copies of the surface/line/accent/bg tokens,
  noted in the file, because a favicon cannot read CSS custom properties. **That note is a `<desc>`
  element, not a comment, and the token names in it are written without their leading dashes on
  purpose:** XML forbids a double hyphen inside a comment, so the obvious way to write this — an
  HTML-style comment naming `--surface` and `--accent` — is a fatal parse error that makes the whole
  file render as a broken image. It cost one round trip to find; don't reintroduce it.
- **Short rules go in one card, not one card each.** The first pass gave each of the five "Other
  rules" its own `.info-card` in a `.deck`. Five boxes of chrome around five one-line rules read as
  clutter, and the grid's equal-height cells left the short ones floating in empty space. They are
  now one card of hairline-separated term/definition pairs. The rule of thumb: a card is for a thing
  you might act on separately — a deck of one-liners is a list.
- **Icons are tone-coded, and the engine's emoji stays unused.** `leagueBrain.ts` ships an `emoji`
  per superlative. The cards map the award's stable `id` to a Lucide glyph and one of the four color
  roles instead. The tone is the award's verdict, so "Best Keepers" and "Buyer's Remorse" no longer
  look identical at a glance — which is the actual complaint behind "boring", not the lack of a
  picture. The `emoji` field is left in core: it is data, and the CLI may yet want it.
- **Every remote image has a same-size fallback.** Sleeper's CDN is not a guarantee — a manager with
  no avatar has none, and a missing headshot returns 403, not a placeholder. Each image is paired
  with an initials disc of identical dimensions, so a 404 changes what a row shows and never how
  tall it is. That is also why the avatars went into the `Row` primitive's existing `leading` slot
  rather than becoming a new list variant.

## 2026-08-12 — Issue #17: sticky offsets were computed from a height nothing enforced

Three bars stick to the top, each offset by the sum of the heights above it. Those sums were literal
(`--control-h-lg + --space-4`), but no rule made the top bar actually *be* that tall — its height came
from its content. In static mode (the deployed site) the tallest thing in it is the `updated …` stamp
at ~33px rather than the 44px refresh button, so the bar landed ~9px short of the offset the context
strip used, and the page scrolled through the difference.

The fix is to make the assumption enforceable rather than to re-measure it at runtime. `--topbar-h`
is now a token, `min-height` on the bar consumes it, and both offsets below are computed from it, so
the constants cannot disagree with reality. A `ResizeObserver` writing the measured height to a
custom property would also work and would survive the top bar growing (its tab row wraps below ~900px
today), but it puts layout in JS for a stack that is deliberately fixed-height. The offsets tuck 1px
*into* the bar above instead of meeting it exactly: fractional device-pixel ratios round the two
edges apart, and a 1px overlap is invisible where a 1px gap is not.

## 2026-08-11 — Issue #9: the Team page had three buttons called "Reset"
Design review of the Team screen. The two the issue names are worse together than either is alone,
and there was a third nobody mentioned:

1. sim bar `Reset` — sets the kept board to the recommended keepers
2. desktop toolbar `Reset to recommended` — the *same action*, different place and label
3. overrides note `Reset all` — clears custom Worth values, a **completely different** thing

Three controls, one word, two meanings. That is the actual defect; the styling complaints follow from it.

**One action, one place, named for its outcome.** Both keeper-set buttons collapse into a single
`Use recommended (N)` in the toolbar above the list, on both breakpoints. The count tells you what
you are about to get, "use" describes the result where "reset" described the mechanism, and it
**disables when the board already matches** rather than silently no-oping. The overrides action becomes
`Clear custom values`, which can no longer be confused with it.

**The sim bar loses its button entirely — the bar reports, the toolbar acts.** A destructive action
that discards every pick you made was sitting bottom-right on a phone: the single easiest place to hit
by accident, and there is no undo. Moving it above the list also matches how it is used, since "start
from the recommendation" is a beginning-of-session move, not something you reach for mid-scroll. The
freed width goes to a third figure (surplus), so the bar now reads cap left · keeping · surplus.

**An interactive chip, not a `.btn`.** `.btn-secondary` stretched to the gutters by `.toolbar > *`
reads as a form submit, which is the weight this action should not have — checking boxes is the
screen's real work. `.chip-interactive` is already the system's 44px "tappable, secondary" primitive,
and it sizes to content. Needed two small rules: a disabled state for chips, and an opt-out from the
toolbar's full-width stretch.

## 2026-08-11 — Issue #7: a readout, not a tooltip
Asked for "an on hover action to display the number they scored that week". A `title` tooltip already
existed and was doing that badly — **it never fires on touch at all**, and this app is used almost
entirely on phones, so the requested feature was effectively missing on the only viewport that matters.

**A readout above the chart rather than a bubble on the bar.** A bubble anchored to a 16px-wide bar
inside a scrolling sheet needs edge-clamping at both ends, and on a phone your finger covers the thing
you are trying to read. A line on the chart's heading — `Wk 12 · 30.9 pts` — needs no positioning
math, cannot overflow, and reads identically under a mouse and a thumb. Hover, tap and keyboard focus
all drive the same state; tapping the active week clears it.

**Columns became `<button>`s.** They are interactive now, so they should be focusable and announced;
this also gets the global focus ring and an `aria-label` per week for free, and lets `aria-live` read
the value out on change. The `title` attributes are gone — a native tooltip racing a live readout is
noise.

**A chart column is deliberately under the 44px touch minimum** (17px at 390px). Seventeen weeks cannot
each be 44px inside 358px, and the invariant is about controls, not data marks — the full 160px column
height is the hit area, which keeps it thumb-reachable. Noted here because it is a knowing exception.

**`.chart-head` instead of reusing `.head-row`.** `.head-row` is `align-items: flex-start`, and an
`h3`'s own top margin then drops the heading ~24px below anything sitting beside it — the readout
floated above the title. The chart header baseline-aligns instead.

## 2026-08-11 — Issue #10: a caveat that outlived the code it described
The drilldown claimed "Only weeks **rostered in the league** are tracked, so earlier NFL weeks may be
missing". That was true of an earlier implementation that read weekly scores out of league matchups. It
has not been true since scoring moved to Sleeper's per-week **stats** endpoint — `core/engines/points.ts`
says so at the top: it "covers EVERY player (not just those rostered in our league)" and counts a
player-week only when `gp >= 1`. So the app does factor in every week, and a gap is not a rostering
artifact — it is a week the player **did not play**: bye, injury or inactive. Jalen Hurts' single gap is
Philadelphia's week 9 bye.

**The same stale assumption had leaked into three more places**, all corrected: the `late-riser` blurb
("Only rostered late") and the `injury-limited` blurb ("Rostered for few weeks") in `PlayerModal.tsx`,
plus the `firstWeek` doc comment and the archetype branch comment in `engines/playerDetail.ts`, and the
`weekly` field comment in `app.ts`. The archetype *logic* is unaffected and stays: with a league-wide
stats source, `firstWeek >= 6` with a short log still means the player did not appear until midseason —
a call-up or breakout rather than lost time — which is exactly what the branch keys on.

Copy-only fix; no engine behaviour changed, so no new tests. The bug was that prose and code disagreed,
and the code was right.

## 2026-08-11 — Issue #11 "years in league wrong": two bugs, one of them the label
Reported as "Matt Stanford has not been in the league the same years as Trevor Lawrence". Both read
**5y**. Investigating turned up two separate defects; only the second is what the reporter saw.

**1. `yearsInLeague` measured a span, not a count.** The type comment said "seasons this player has been
in the league"; the code computed `currentYear - firstAcquisitionSeason + 1`. Those diverge the moment a
player leaves and returns — someone taken in the 2022 startup auction, dropped for two years and
re-signed still read as a 5-season veteran. It also collapses toward a constant in a startup league,
because everyone in the first draft shares an entry season. Fixed with a **presence index** (season →
players on a roster that season, unioned with that season's acquisitions, so players added and dropped
inside one year still count) and `seasonsInLeague`, which counts. Rosters were already being fetched by
`buildAcquisitionIndex`, so this costs no extra API calls. Moved 7 rostered players off the 5y pile.

**2. …but that did NOT explain the report, and the honest answer was the label.** Stafford and Lawrence
*have* both been on a Los Socios roster every season since 2022, so 5y was right for both. "In league"
is the problem: in football that phrase means **NFL** seasons, universally. Stafford has 17 and Lawrence
5 — of course they looked wrong as equals. So the field is now **"Rostered"** (seasons on a Los Socios
roster) and **NFL experience is its own column**, from Sleeper's `years_exp`, which the codebase was
already fetching for the rookie board and the RB age cliff. It costs nothing and is what the reporter
was actually looking for.

**A defense gets `nflExperience: null`, not the 0 Sleeper reports.** 0 means "incoming rookie" in this
field, and the Steelers are not a rookie.

**`leagueEntrySeason` is deleted.** Replacing the span math left it referenced only by its own tests.

## 2026-08-11 — Closing PR 1's token leaks, and `.gitattributes`
**Three values never made it into the token set**, and PR 7's sweep did not catch them because it
looked for dead rules, not for raw values. Found by re-running PR 1's own grep criteria against the
finished stylesheet: two `rgba(76,141,255,…)` literals (the selected/kept row wash and its hover),
`font-size: 15px` on `.seg button`, and `border-radius: 3px` on `.wk-bar`. The first two are now
`--accent-wash` / `--accent-wash-hover` and `var(--text-body)` — 15px *is* the body step, it was just
written out. Verified inert: every computed value is byte-identical before and after.

**`.wk-bar` gets its own `--radius-bar: 3px` rather than mapping to `--radius-sm`.** The bars are 16px
wide at 390px (30px on desktop). A 6px cap on a 16px bar rounds the entire top into a dome — the
control radius scale is for controls, not for a data mark this narrow. A token keeps the "no raw radius
outside `:root`" rule true while being explicit that this is a fifth value with exactly one caller.

**Four sub-scale spacing values remain and should**: `padding: 1px`, `gap: 2px`, `margin: 2px` are
optical nudges below the 4pt scale's own floor, and `padding: 0 14px` on inputs is specified verbatim
by the handoff. Inventing `--space-0-5` for a 2px nudge would grow the token set to hide four numbers.

**`.gitattributes` (`* text=auto eol=lf`).** `cli/src/index.ts` had sat "modified" with an empty
`git diff` for the whole rollout. Cause: no `.gitattributes`, so normalization depended on each
machine's `core.autocrlf`, and the file had picked up MIXED endings — some lines written by a tool
(LF), some checked out by Git (CRLF). The repo content was never wrong (the index has always been
uniformly LF; `git add --renormalize .` produced zero content changes). What was wrong was that
correctness lived in a local setting instead of in the repo. `eol=lf` also makes the working tree
consistent, so tool-written and Git-written files stop disagreeing.

## 2026-08-11 — PR 7: the stylesheet got BIGGER, and three other calls
**The "meaningfully smaller than 17.6KB" criterion is not met — 17.6KB → 37.3KB source (26.8KB built).**
Recording this rather than massaging it. The consolidation the handoff predicted did happen: 10 button
treatments → 4, 10 chip styles → 3, three toggle-group implementations → 1, four card rules → 1, and
28 colors / 14 font sizes / 21 spacing values / 9 radii → a 24-token set. It was outweighed, because
the same rollout *added* seven components the 17.6KB stylesheet never had — Sheet, Row, bottom tab bar,
context strip, sim bar, swap card, list bar — plus a focus-visible layer, disabled states, and an
explicit desktop layer where before there were two `max-width` queries. The criterion assumed this was
a pure consolidation pass; it was a consolidation *and* a build-out. The honest metric is rule count
per concept, not bytes.

**Rules keeps one table, against the letter of 6.3's sibling line.** 7.1 says "the two `maxWidth:420`
tables become rows" and then, in the same sentence, that the rookie cost table stays a table. There are
exactly two such tables, so the sentence contradicts itself. The specific instruction wins: keeper
escalation (5 rows × 3 columns, a list) becomes rows; the rookie cost matrix (12 slots × 4 positions,
genuinely two-dimensional) stays a table, showing one position at a time on a phone.

**No sticky first column on the rookie table.** 7.1 asks for one on desktop. That table is five narrow
columns capped at 420px — it cannot overflow at any width we support, so the rule would never fire, and
7.2 in the same PR asks me to delete rules nothing references. Writing inert CSS to satisfy one line
item while another forbids it is the wrong trade.

**One inline style survives.** `grep "style={" web/src` returns exactly one hit: the scarcity bar's
`width: <score>%`. A data-driven dimension is what the style attribute is for; the alternatives are a
ref + effect, or ~21 width utility classes. The criterion was aimed at the ~25 *static* style objects
(`marginTop: 0` copy-pasted across six views), and those are all gone.

**`table.grid`'s block-scroll is finally deleted.** PR 5 kept `display:block; overflow-x:auto` because
five un-migrated tables would otherwise have pushed page-level horizontal scroll. With Dashboard's
standings merged into rows, the only table that renders below 760px is the rookie cost matrix, and it
measures 358px at 390px. Verified: zero scroll containers in `main` on all eight destinations.

## 2026-08-11 — Task 6.4 (Trades): the swap card is not a mobile variant
**The swap card replaces the table at every width, unlike every other list in PR 6.** Those lists render
rows on mobile and the old table above 760px because the Row spec explicitly allows it. The handoff
describes the swap card differently — as what the six-column table *becomes*, not as a phone layout —
and the card is genuinely the better read at any width, so there is no desktop table to fall back to.
Above 760px the cards pair two-up instead. This also removes the last three block-scrolling tables
outside Dashboard.

**Sharky vs mutual-fit is carried on two channels, not one.** Before, the only difference between the
modes was a "both ✓" column that the sharky table omitted — invisible if you were not comparing. Now the
card takes a 3px left accent (success for mutual-fit, warning for sharky) and the footer mark states
which it is ("both fill a need" / "favors you"). The 3px left border is the variant mechanism the
handoff's Card section sanctions, so this adds no new pattern.

**Salaries moved from the name line to the footer.** `GIVE Christian McCaffrey RB $69` on one line
leaves ~110px for the name at 390px, which truncates real names. In the footer the pair reads as
`$72 → $25` — the salary swap, which is more useful than two isolated numbers — and every name then
fits: 24 of 24 unclipped across the 12-card sharky list.

## 2026-08-11 — Task 6.3 (Tiers + Rookies): compact pills, and one asymmetry
**Prospects render as rows at every width; the pick board keeps its desktop table.** That looks
inconsistent until you read the criteria: 6.3 explicitly requires deleting `.prospect-grid` *and its
760px query*, which leaves rows as the only prospect layout. The pick board is a table in the handoff's
own before/after, so it follows the mobile-rows / desktop-table split every other list uses.

**`.cost-pills.is-compact`.** Four slot-cost pills at full size need ~340px, and a row card's meta line
offers ~275px at 390px — they would wrap, and "slot-cost pills fit one row per pick" is the criterion.
Compact drops the *nested* `.pos` chip to plain colored text (the position color classes set `color` as
well as `border-color`, so it survives), which brings the set to 224px. A chip inside a chip is the kind
of thing this rollout exists to remove, so the desktop table is the only place it still happens.

**The base-order table stays a table.** 6.3 says the reveal "keeps its `<details>`" and says nothing
about converting the table inside it. It measures 358px at 390px — it does not scroll — so there is
nothing to fix. It is a reference you open once, not a list you work in.

**`.notice` gained a bottom margin.** Three views were hand-rolling `marginBottom: 16` inline. Every
current call site is either followed by content (where the margin is wanted) or is the only child
(where it is invisible), so this belongs on the rule, not the call site.

## 2026-08-11 — Task 6.2 (Market): the scarcity reveal, and where rows stop
**Scarcity stays cards, not rows.** 6.2 says the cards "keep their bars but adopt card tokens" — the bar
is the whole point of that screen and a row's trailing-metric zone has nowhere to put it. So the card
survives; only the `<details class="reveal">` inside it becomes the row idiom: a 44px `.card-expander`
with the row chevron, over `.row`s that run to the card's edges (`.card-rows` cancels the card padding)
so they read as a list rather than a box inside a box. `.scar-row` is deleted with its only call site.
`.reveal` stays — Rookies still uses it, and 6.3 owns that.

**Δ and its percentage share the metric line, not a metric + microlabel.** Putting the percentage in the
`--text-micro` label under the value would technically fit, but the criterion is that they stay on *one*
line, and they are one value. `.row-metric-v` is now `white-space: nowrap` globally, which is right for
every trailing metric — the widest case measured is `+$10 (+1000%)` at 124px of a 390px row.

**`.filters` → `.toolbar` on the auction sub-tab.** The two are near-duplicates; `.toolbar` is the one
documented for control bars inside a view body and it stacks full-width on mobile. `.filters` survives
only as the desktop Players filter row, which is what PR 7.2's sweep will find.

## 2026-08-11 — Task 6.1 (Players): three calls the handoff left open
**The trailing metric follows the sort key.** 6.1 says "rows with last-season points as the trailing
metric", but the Row spec says the trailing zone is "the metric the screen is *about*" — and with sort
moved off the table headers into a sheet, a fixed metric would leave you sorting by keeper cost while
every row shouts last-season points. So the metric is whatever you sorted by (points is the default, so
the literal reading still holds on first paint), and the two it displaces move into the expander. This
also does most of the work for "sort direction is clear without a table header".

**Trending leads with adds, not points.** Same principle: the list is *ranked* by adds. Points stay in
the expander.

**The context strip is now a fixed 61px (`--ctx-h`).** `.list-bar` sticks at
`calc(--control-h-lg + --ctx-h)`, and a content-driven strip changes height per tab (44px picker vs a
line of `ctx-meta` text), which would leave rows sliding through a gap. Pinning it costs nothing today —
every tab that shows a picker already measures 61px — and buys a constant offset for any future
sticky element. Only below 760px does anything stick to it.

**Native `<select>` inside the filters sheet.** Task 4.3 replaced native pickers with sheets, but that
was about the context strip. Nesting a picker sheet inside a filter sheet means two focus traps and two
scroll locks; the selects are already 44px/16px and keyboard-accessible, so they stay.

## 2026-08-06 — Resilience+perf: timeout, circuit breaker, request coalescing, permanent history cache
`team`/`keepers` hung under throttling (no fetch timeout) and re-pulled immutable history every run.
Fixes: (1) per-request AbortController timeout (7s) so hangs fail fast; (2) module-level circuit breaker
— after a call exhausts retries, remaining calls this run fail fast so the cache serves stale data in
seconds instead of grinding through ~200 timeouts; (3) in-flight coalescing in `cached()` so concurrent
identical fetches (FAAB + acquisition share transactions) dedupe; (4) past-season transactions/matchups
cached PERMANENTLY (immutable) via a `historical` flag on getTransactions/getMatchups — the big win:
cold run dropped ~26s→7s, warm ~3s, and API load drops sharply (main throttling cause). Also serve
stale-on-error and surface err.cause (ENOTFOUND/ECONNRESET/etc.). Tests: coalescing + stale-fallback.

## 2026-08-06 — Fetch retry/backoff + build league indexes once (fixed `keepers` fetch-fail)
`sgm keepers` (all 12 teams) crashed with "fetch failed" — a transient network/rate-limit error with no
retry, made worse by rebuilding the full history indexes per team (12×). Fixes: `fetchJson` retries
429/5xx/network with exponential backoff (0.3→2.4s) and reports the failing URL; CLI now builds
draft/FAAB/acquisition indexes + valuation ONCE via `loadKeeperData` and reuses across teams. Per-team
functions (`teamKeeperLines`, `teamSurplusBoard`) are now sync over prebuilt data.

## 2026-08-07 — Pluggable value sources (M8, issue #2) + Data page raw (M7)
**M7:** Data page is now raw facts only — dropped worth/surplus/call, added an NFL-team column + filter
(added `nflTeam` to KeeperLine, flows through /api/players + snapshot).
**M8:** worth is now source-driven, not just VORP. `config/values/<name>.csv` sources overlay the VORP
fallback; `overrides.csv` always wins; one active source via `SGM_VALUE_SOURCE` (default `adp` if present
else `vorp`). Pure `matchValues` maps names→Sleeper ids (strip punctuation/suffixes; DEF by team code;
tiebreak pos+team; reports unmatched). Shipped a real automated source: `scripts/fetch-adp-values.ts`
pulls Fantasy Football Calculator's public ADP and `adpToAuctionValues` (convex ADP→$ curve) writes
`config/values/adp.csv` — 255/256 matched. Premium sites (FantasyPros/DraftSharks/FootballGuys) gate
values behind JS/login so we don't scrape them; users drop in a CSV export instead (config/values/README).
`loadValues` in core/app.ts does the overlay, so CLI + server + snapshot all use it automatically;
`worthSource()` surfaced in /api/league, snapshot, and the web header. New `sgm values` command; nightly
Action refreshes ADP before snapshotting. Result: Chase $87, A.J. Brown $47 — the mis-values are fixed.
57 tests green. (Web live source-switching deferred — static bakes one active source.)

## 2026-08-06 — Static build for GitHub Pages via a data snapshot (T35), + mobile pass
**Static hosting:** rather than refactor the Node core to run in the browser (fs cache/config/env make
that messy), chose a snapshot approach: `scripts/snapshot.ts` runs the SAME engines the server uses and
writes one `web/public/data.json` (all view models: league, per-team base+inflated, inflation, players,
rules, per-team trades). `web/src/api.ts` now decides mode at runtime — if `./data.json` loads it serves
from it (static, GitHub Pages), else calls `/api/*` (local server). Views unchanged. Trades partner
filter runs client-side on the snapshot. `base: "./"` so it works at any Pages path; single-page (tab
state) so no 404 fallback needed. Verified: served web/dist from a plain no-API static server and the
whole app renders + is interactive from data.json alone. Deploy steps in web/DEPLOY.md; refresh = re-run
`npm run web:static`. One source of truth for LOGIC (only response shapes are replicated in the snapshot
script). **Mobile:** header stacks, tab nav scrolls, wide tables scroll horizontally (@media ≤760px).

## 2026-08-06 — Web polish: Rules + Data pages, interactive keeper sim, Trades partner/sharky (T34)
Added `/api/players` (flattened league keeper lines). Web: **Team** page now has an interactive keeper
SIMULATION — per-row checkboxes seeded from the keep/hold/cut call, live sim cap used / left / surplus
(the `simulate` CLI command, in-page). **Trades** got a partner-team `<select>` (?partner=) and a
mutual-fit ↔ sharky toggle (both come from computeTrades already). New **Data** page: all rostered
players, client-side filter (team/position/search) + click-to-sort columns. New **Rules** page renders
league-rules.ts (escalation bases + full rookie table). All verified live in-browser.

## 2026-08-06 — M5 web: extracted orchestration to core; Express API + React/Vite UI (T32/T33)
Moved the CLI's network orchestration (loadContext/loadKeeperData/teamKeeperLines/teamSurplusBoard/
leagueInflation/inflateBoard, Ctx/KeeperData, STREAMER_POSITIONS) out of `cli/src/lib.ts` into
`core/src/app.ts` (relative imports, no barrel cycle) so the CLI AND the server share ONE
implementation; cli/lib.ts deleted, commands import from @sgm/core. `server/` = Express (tsx) exposing
/api/league,/team/:id,/inflation,/trades/:id,/rules,POST /refresh; memoizes assembled state 5 min;
serves web/dist if built (one port). `web/` = React 18 + Vite, plain CSS dark theme, no router (tab
state), local API types (no core in browser). `npm run web` builds UI + serves on :3001. Verified live:
Dashboard, Team (keeper board + inflation toggle), Inflation all render real data. 53 tests still green;
server type-checked in the gate (added server/src to root tsconfig). Web not in the gate (jsx; Vite
build is the check). Chose plain CSS over Tailwind and fetch/useAsync over TanStack Query to minimize
setup risk for the first working UI.

## 2026-08-06 — Trade explorer v2: positional need + mutual-fit (less sharky) — T31
Added roster-need modeling so the DEFAULT trades view is mutually beneficial, not one-sided. Per team,
per skill position: need = baseStarterSlots (integer QB1/RB2/WR2/TE1, FLEX ignored on purpose) −
count(startable players, worth≥$12). need>0 short, need<0 depth. A swap "fills" for a team when it gives
from depth (need<0) and receives at a relatively thinner position (higher need) — covers real shortages
AND depth-for-depth rebalancing (the everyday "you're stacked at RB, I'm stacked at WR" trade). Default
`fairSwaps` = both teams fill + comparable worth + ≤$15 surplus swing; `--sharky` keeps the surplus-max
view. Verified: deep team (Jahmyr) gets balanced depth swaps; thin team (Blotter, all "set", no depth)
correctly gets none → its lever is the sharky A.J. Brown dump. rosterPositions now on Ctx. Tested.

## 2026-08-06 — `keepers --inflated` + trade explorer (T29/T30)
**--inflated:** `keepers -i` scales skill worth by the league inflation multiplier (K/DEF unchanged),
re-ranking the board to real auction-market worth. Reveals that at true prices even A.J. Brown ($45)
flips to a "keep" vs. rebuying. Shared `leagueInflation()` + `inflateBoard()` in lib; `recommendation()`
exported from core. **trades:** `sgm trades <team> [--partner X]` — pure engine `computeTrades`: your
chips (surplus assets), dead weight (overpriced, shop these), buy-low targets (cheap studs elsewhere),
and talent-neutral SWAPS (comparable worth) ranked by MY surplus gain + cap relief. 1-for-1 surplus is
zero-sum (stated in output); swaps diversified to ≤3 per give-player. K/DEF excluded (no trade value).
Correctly flags offloading A.J. Brown as the top move. Both tested; 52 tests green.

## 2026-08-06 — K/DEF are streamers: flat ~$1 worth, out of the pool + inflation (fixed overvaluation)
VORP→$ overvalued kickers/defenses (Aubrey $34, Seahawks $29…) because they score points, but the
market pays ~$0 (user: max $3 DEF, $1 K, most streamed free). Fix: `valuePlayers` treats
`streamerPositions` (default K/DEF) as flat `streamerValue` (default $1) and EXCLUDES them from the
dollar pool, so QB/RB/WR/TE absorb it (skill worths rose, e.g. Achane $59→$70 — more realistic). The
`inflation` command also drops K/DEF from the keeper economy (they'd never be value-kept). Result: NE
DEF now worth $2 → "hold" at $3; inflation drivers are all skill players; multiplier ×2.0→×2.53 (money
now concentrated on skill). Per-position `streamerValues` (default K $1, DEF $2) is configurable. T28.

## 2026-08-06 — Salary sheet is superseded by a re-acquire in its season+ (fixed stale Javonte)
The workbook is a PRE-auction snapshot of its season (2025). A player re-drafted/re-added via
auction/FAAB in 2025+ has a reset cost (§6.3) the snapshot never saw. Bug: Javonte Williams showed $41†
(sheet: Hunt Greatness's stale $32 keeper) though the user re-bought him in the 2025 auction for $5.
Fix: `sheetSupersededByReacquire(sheetSeason, acquisitionSeason, acquiredVia)` — if the most-recent
PRICED acquisition (auction/faab/free_agent) is ≥ sheetSeason, skip the sheet and use the API-computed
cost. Trades don't reset, so traded players (A.J. Brown, basis 2022) still use the sheet. Javonte now
$5→$12 computed; kept players unchanged. Tested.

## 2026-08-06 — Inflation modeled as keeper-surplus → auction multiplier (per the user's framing)
User clarified inflation isn't "player overpriced" — it's that cheap keepers leave surplus cap in the
economy chasing a smaller auction pool, so available players' true worth is HIGHER than a naive
full-budget valuation. Engine (`computeInflation`, pure): rational keepers = surplus>0 (raw worth −
salary, matching the board so decisions/$ aren't distorted); keeperSurplus = Σ(worth−salary);
multiplier = (capTotal − keeperSalaries)/(capTotal − keeperWorth) = 1 + keeperSurplus/auctionValue.
Live: 53 keepers, $855 surplus, ×2.0 (~100% over face); valuation calibration vs cap ≈ 0.98 (so worth
and money share a scale — no normalization applied, only reported). `sgm inflation` shows top discount
drivers + per-team surplus. Did NOT feed the multiplier back into board worth yet (circular; left as a
future `--inflated` view). Also made `keepers` take a positional `[team]` like `team`.

## 2026-08-06 — Imported the commissioner's workbook → config/salaries.csv (authoritative)
Parsed "League Deployment.xlsx" (no python; unzipped the xlsx + a Node XML parser). Sheets: Salary
Dashboard (163 players: Manager/PlayerID/Name/Pos/Team/Status/Old Salary/Years Kept/Salary
Increase/New Salary) and Contract Ledger (Prev Year Salary/Years Kept). This CONFIRMED our escalation
formula exactly (e.g. Rashee Rice WR 9→17 via +8=6+2; PHI DEF 0→1). **League Info says Season = 2025**
and the dashboard has zero 2025 NFL rookies → "New Salary" is the **2025** salary. So we escalate it ONE
year to 2026 (McConkey 8→16, A.J. Brown 36→45, Hurts 22→29 — all verified). Wrote `config/salaries.csv`
(season 2025, 163 players) and taught `loadSalarySheet` to prefer CSV (parseSalaryCsv, pure+tested) over
JSON. The user is "Josh Blotter". Sheet salaries display `†`; players absent from the sheet fall back to
computed (`≈`).

## 2026-08-06 — Salary carries (accumulates) through trades; + optional salary-sheet override
User confirmed: (1) 2026 keeper cost = current salary escalated one year; (2) a trade carries the
ACCUMULATED salary (not a reset to original draft price) — only the years-kept term resets.
Implemented `accumulatedSalary` (engines/keepers.ts): replays the salary from origin to the target
season, carrying it across owners while resetting the "+yearsKept" term at each ownership stint
(`stintStarts`). Fixed the earlier wrong "reset base to original on trade."
Added an optional authoritative override: `config/salaries.json` (`loadSalarySheet`/`sheetSalary`) with
per-player `{salary, yearsKept}` as-of a season; the app escalates forward. With `yearsKept` supplied
this is EXACT even for pre-2022 players (verified: A.J. Brown $45, Pickens $35, Hurts $29, Achane $25 —
all match the commissioner's numbers + one year). Computed (non-sheet) salaries flag `≈` when the player
was traded or has an auction origin at the oldest visible season (pre-Sleeper risk). Task T26.

## 2026-08-06 — Reconciled vs the commissioner's salary sheet: 3 causes of difference
Compared our output to the league manager's app for 6 players. **Our escalation formula + rookie table
are CONFIRMED correct** (clean user-drafted cases match exactly: McConkey $8@N1, Achane $16@N2,
Pickens $25@N3 as 2025 salaries). Differences come from:
1. **Season offset (dominant):** commissioner shows the CURRENT (2025) salary; we compute the upcoming
   2026 keeper cost = one more escalation. Our 2026 = their 2025 + one year (McConkey 8→16, Achane
   16→25). This is the user's own hypothesis; not a bug.
2. **Pre-2022 history the API lacks:** Hurts (kept 5 → since ~2020) and A.J. Brown ($36 implies a
   carried basis ~$21, not the $1 the 2022 auction shows) both have keeper history before Sleeper's
   earliest visible season (2022). We cannot reconstruct it from the API.
3. **Trade/acquisition-year counting:** preseason trades (Pickens, 2023 wk1) count that season as kept;
   mid-season (A.J. Brown, 2023 wk9) and rookie-draft years do not. Our `currentSeason − tenureStart`
   under-counts the preseason-trade case by 1.
**Recommended fix (pending user):** import the commissioner's current salary sheet as the authoritative
base, then apply exactly one escalation for 2026. Sidesteps #2 and #3 entirely. Trace tool
(`npm run sgm:trace`) now shows full draft+trade timelines and was the key diagnostic.

## 2026-08-06 — yearsKept is per-owner and resets on trade (base salary still carries)
Escalation's "years kept" counts only the CURRENT owner's tenure; a trade resets it, but the base
salary keeps the player's original draft/auction value. Implemented via `buildAcquisitionIndex` +
`ownerTenureStart` (draft `picked_by` + transaction `adds`→owner, user_ids stable across seasons);
`lib.ts` overrides `yearsKept = currentSeason − tenureStart`, falling back to the cost-basis season
when no acquisition-by-owner is found. Verified live: A.J. Brown 4→3 yrs ($35→$25); Hurts stays 4
(drafted by current owner, never traded). Task T25.

## 2026-08-06 — Real keeper rules encoded; escalation replayed annually (compounds)
User supplied the rules. §6.1: skill positions `new = old + positionalBase + yearsKept` (QB 1, RB 6,
WR 6, TE 3); K/DEF `+$1/yr`. §6.4: rookie starting salary from a slot×position table (single 12-pick
round). **Key interpretation:** the formula is an annual recurrence on *last year's* salary, so we
replay it from the acquisition season → closed form `base + N·posBase + N(N+1)/2` (skill), `base + N`
(K/DEF), with N = yearsKept = currentSeason − acquisitionSeason. Rookies start escalating the season
after they're drafted. Flagged for user confirmation in docs/league-rules.md; changing the count is a
one-line edit. Verified live: A.J. Brown $35, Achane $25, Hurts $18, NE DEF $3.

## 2026-08-05 — Cost basis = ALL drafts per season (auctions + rookie linear); trades carry, don't reset
Superseded the earlier "trade-acquired = unknown" gap. Root cause was that we read only
`league.draft_id` (one auction) per season. Fix: `buildDraftIndex` enumerates **every** draft per season
via `getDrafts` — all auctions **and** the `linear` rookie draft. Rookie picks index by `(round, slot)`
and dollarize via the §6.4 schedule. **Trade carryover falls out for free:** trades aren't priced draft
events, so scanning by `player_id` naturally lands on the player's original draft basis (confirmed:
A.J. Brown → 2022 auction $1, carried through a later trade). Re-auction/waiver still reset because the
newest priced event wins, and in-season FAAB is checked before the same season's preseason draft.
Verified live: the user's roster now resolves with ZERO unknowns. Task T24 done.

## 2026-08-05 — [SUPERSEDED] Trade-acquired players get `unknown` cost
Was accepted as a temporary gap; fixed same day by the all-drafts refactor above.

## 2026-08-05 — CLI-first, pure-core architecture
Logic lives in `core/` as pure functions; CLI/web are thin consumers. **Why:** lets every engine be
tested offline and exercised in the terminal the day it's written (user priority: "test early").

## 2026-08-05 — Fake the two open house rules behind config, don't block
Keeper escalation (§6.1) and rookie cost (§6.4) are unknown. Encoded as `placeholder: true` values in
`config/league-rules.ts` (flat +$5/yr; flat $3). **Why:** unblocks all downstream engines; swapping in
the real rule touches exactly one file. `sgm rulebook` prints an OUTSTANDING banner so we never mistake
placeholders for truth.

## 2026-08-05 — `yearsKept` approximated from most-recent acquisition
Sleeper doesn't reliably flag keepers historically (`is_keeper` was null in the 2025 draft data). So
`yearsKept = currentSeasonYear − seasonOfMostRecentAcquisition`. **Why:** good enough for a placeholder
escalation model; revisit if the real §6.1 rule needs true consecutive-years-kept.

## 2026-08-05 — Cost basis = most-recent acquisition across the season chain
Provenance scans seasons newest→oldest and takes the first hit (auction `metadata.amount` or FAAB
`waiver_bid`). **Why:** this naturally implements rule §6.3 (re-acquire resets cost) with no special case.

## 2026-08-05 — Valuation v1 = VORP→$ on last-season actual points
No external projections dependency yet; use prior-season realized points as the projection proxy,
convert points-above-replacement to auction dollars scaled to the 12×$200 pool. **Why:** end-to-end and
offline now; swap in real projections later behind the same interface.

## 2026-08-05 — tsx + moduleResolution "bundler", no build step for dev
Run TS directly with `tsx`; typecheck with `tsc --noEmit`. **Why:** zero build friction for a small
personal tool; extensionless ESM imports resolve cleanly.

## 2026-08-07 — Snapshot bakes value-dependent view models PER source (static source-switching)
The static site has no backend, so to let the web switch value sources (adp/vorp/imported) live,
`scripts/snapshot.ts` writes `data.json → bySource[src]` (teams/inflation/trades per source) plus one
source-independent block (team list + raw player rows). The web picks the source client-side; the
server mirrors it with `?source=` on the value-dependent routes. **Why:** a dropdown that feels like the
team selector, with zero hosting cost. Cost: `data.json` grows ~linearly per source (594 KB for 2) —
fine for 2–4 sources. `withValueSource(ctx, data, src)` re-overlays values on the SAME league indexes,
so extra sources are cheap (no re-fetch of history).

## 2026-08-07 — Data page shows "years in league" + "last-season points", not fantasy tenure
User feedback: the Data page should be "just player info", not fantasy-team specific. Dropped
Via/Season/Yrs-kept. Added **last-season points** (already computed as the VORP proxy — `KeeperData.points`)
and **years in league** = `currentSeason − leagueEntrySeason + 1`, where `leagueEntrySeason` is the
OLDEST season the player appears in the acquisition index (any manager). **Why:** "years kept" resets on
trade and is owner-specific; "years in league" answers "how long has this player been in Los Socios?"
Horizon is the season chain (2022+), so a 2022-or-earlier arrival reads as the max (5 in 2026).

## 2026-08-07 — Named expert sources = import slots (not scraping); manual override = in-browser
User wanted FantasyPros/CBS/DraftSharks/Footballguys as selectable sources. Those sites gate auction
values behind JS/login, so scraping is fragile/ToS-murky. Decision: ship pre-made **import-slot CSVs**
(`config/values/<site>.csv`) with headers + paste instructions; `listValueSources()` hides any CSV that
has only a header/comments, so an empty slot never shows in the dropdown until filled + re-snapshotted.
ADP (the one auto source) stays, sourced from Fantasy Football Calculator's PUBLIC ADP API and now
labeled as such on the Rules page. **Why:** honest and reliable — you see exactly that site's numbers,
no scraper to break.

Manual overrides: shipped as an **in-browser editor** (localStorage `sgm.overrides.v1`) on the Team
board — click a Worth to set/reset a custom value; worth→surplus→recommendation recompute client-side
(recommendation thresholds duplicated in `web/src/overrides.ts`, kept in sync with
`engines/surplus.ts`). **Why:** the primary deployment is the static Pages site (no backend to persist
to), and keeper decisions happen on the Team board. Trade-off: overrides overlay the Team board only;
league Inflation and Trades use baked snapshot values. The durable, everywhere-applied path remains
`config/values/overrides.csv` (baked at snapshot time, wins over any source).

## 2026-08-07 — Rookie draft order derived from reverse regular-season standings
Sleeper doesn't publish the upcoming rookie order (the only 2026 draft is the auction; draft_order null,
slot_to_roster_id identity). The playoff bracket covers only 4 of 12 teams, so there's no clean final
1–12 ranking to reverse. Decision: base order = reverse of last season's **regular-season** standings
(wins asc, then points-for asc), then apply `/league/{id}/traded_picks` for current ownership. Flagged
as "derived" in every surface. `rookieDraft.rounds` defaults to 1 (the only round with a §6.4 cost
table) and is marked assumed; the engine (snake order + traded-pick resolution) generalizes to N rounds,
with later-round costs shown as "—" until a table exists. Roster_ids are stable 2025↔2026 in this league,
so picks map directly; names resolve via the current registry.

## 2026-08-07 — Nightly deploy switched to the official GitHub Pages Actions deploy
The old `refresh.yml` committed `web/dist` into `docs/` and relied on the legacy "deploy from branch"
Pages build. Two problems: it was never pushed (so never ran), and GITHUB_TOKEN pushes don't reliably
re-trigger the legacy Pages build under the repo's read-only default workflow permissions. Rewrote it to
build + deploy in one job via `actions/configure-pages` + `upload-pages-artifact` + `deploy-pages`
(permissions: pages: write, id-token: write). Requires Pages Source = "GitHub Actions" (one-time settings
flip). This removes the `docs/` round-trip entirely and is GitHub's current recommended path.

## 2026-08-07 — Players page: include free agents, but filter the 11k-player dump to "relevant"
The Players page (formerly Data) only showed rostered players; relevant free agents were invisible.
`players/nfl` (the full dump, ~11k, 5MB — Sleeper says fetch ≤ once/day; we cache it 24h) is too noisy to
show whole. Decision: show rostered players + free agents that are **fantasy-relevant** = present in the
ADP value list OR scored ≥50 fantasy points last season. That yields ~300 rows (204 rostered + ~96 FAs)
— enough to cover pickups without the dead weight the user called out. Kept the page source-independent
(no worth column). Added a **Trending** sub-tab from `players/nfl/trending/add` (most-added last 24h) as a
lightweight waiver-buzz signal.

## 2026-08-07 — Historical draft value = last season's auction buys only (source-aware, baked per source)
Feature #2 answers "are we projecting players as high as last year's actual auction price?" Scope: only
**auction, non-keeper** picks from the previous season (`DraftIndex` entry `source==="auction" && !isKeeper`)
— carried keepers and rookie-draft picks are excluded, matching the user's ask. Worth comes from the
active value source, so the report is value-dependent and is **baked per source** under
`bySource[src].draftValue` (like teams/inflation/trades) and served with `?source=` — switching the value
dropdown re-computes it. Kept players stay in the list but are flagged (with their new keeper cost) rather
than shown as re-auctionable. Home: the Inflation page was promoted to a **"Market" hub** with
Inflation / Last-year auction sub-tabs (Scarcity #3 will join it).

## 2026-08-07 — Draft toolkit #5 (drilldown) + #3 (scarcity)
**#5 Player drilldown:** grade consistency off the **median** weekly (not mean) so one 40-burger can't
fake an A; archetype from coefficient-of-variation + max-week-share + games (one-week-wonder = a single
spike ≥25% of the total with ≤1 boom week — the Kyle Pitts case). Weekly game log via a new
`weeklyPoints`/`seasonWeeklyPoints` pair beside the existing summing `seasonPoints`. Details are
source-independent (points + grade + keeper cost don't depend on the value source) so they're baked once
top-level (`bundle.playerDetails`) and opened via a global `playerModalStore` (no prop-drilling). Grade/
boom/bust thresholds live in `engines/playerDetail.ts` as tunable estimates. Web-only.

**#3 Positional scarcity:** "kept" = **rational keeper** (rostered AND surplus > 0), matching the
inflation model — NOT raw rostered. Before managers trim to keepers everyone is rostered, so raw-rostered
reads 100% for every position; the surplus proxy treats overpriced roster players as likely cuts and
differentiates positions (live: RB 83%, WR 100%, QB 52%, TE 39%). Value-dependent → baked per source. The
Inflation page was promoted to a **"Market" hub** (Inflation / Scarcity / Last-year auction sub-tabs).

Note: nothing committed yet, so parallel worktree subagents weren't viable (they'd branch off stale HEAD);
built #5 and #3 sequentially in one working tree instead.

## 2026-08-07 — Draft toolkit #4 (tier board): gap tiers per position, fixed $ bands cross-position
Two different clusterings because one size doesn't fit: **per position** uses gap-clustering (`tierize`)
so a tier ends at a real value cliff (Josh Allen alone in QB Elite; McBride+Bowers as top TE). Pure
relative gaps leave fat top tiers on smooth high-value curves (17 "elite" RBs), so the break rule caps
the required gap at an absolute `absBreak` ($6): `drop ≥ max(minGap, min(gapPct×prev, absBreak))`.
**Cross-position** can't gap-cluster (a dense mixed list collapses to one tier), so it uses **fixed $
bands** (`bandize`, edges [60,45,32,22,14,8]) — that's the right model for "is this TE worth a WR-tier
price?" (McBride $20 lands in the $14–21 band beside Nabers/Higgins/Adams). Value-dependent → baked per
source. Also renamed the nav tab Inflation → Market (the page became a hub in #2/#3).

## 2026-08-07 — Scoring source: Sleeper STATS endpoint, not league matchups
League matchups (`players_points`) only report rostered players, so any weekly/season points derived from
them silently omit free-agent weeks (a mid-season breakout reads as injured — the Michael Wilson bug).
Switched `seasonPoints`/`seasonWeeklyPoints` to Sleeper's per-week **stats** endpoint
(`/v1/stats/nfl/regular/{season}/{week}` via `sleeper.getWeekStats`, permanent cache), which returns every
player with `pts_ppr` + `gp`. Verified `pts_ppr` == this league's scoring exactly (vanilla PPR, `rec:1`, no
bonuses; Chase 2025 290 == 290), so there's zero drift for rostered players and we gain full NFL game logs
for everyone. Count a week only when `gp ≥ 1` (byes/DNPs are real gaps). Functions now take an NFL season
YEAR, not a leagueId. This improves the drilldown (true logs/archetypes), positional finishes (ranked vs
all players), and VORP/last-season coverage (free agents included).

## 2026-08-07 — Draft toolkit #1 (target assistant): client-side scoring over a baked pool
The Targets tab must react to your LIVE keeper selection, and the primary deployment is the static Pages
site (no server) — so scoring runs client-side. Design: bake a per-source `targetPool` (all skill players
with worth/tier/owner/projectedKeeper) + `league.starterSlots`; the Team page lifts its keeper-sim
selection into a shared per-team **kept store** (localStorage, seeded from recommended keepers) that both
the Keepers and Targets sub-tabs read. `views/Targets.tsx` computes needs from the kept set and scores the
available pool — a deliberate MIRROR of the tested core `computeDraftTargets`/`positionalNeeds` (documented
"keep in sync"), same precedent as `recommendation()`. Scoring = value × need-multiplier + QB-stack bonus −
NFL-team-diversity penalty, with a "why" per pick. Availability = rational-keeper proxy (worth ≥ keeper
cost ⇒ assumed kept/off-board) with an "assume everyone available" override, since real availability isn't
known until managers lock keepers. This completes the 5-feature draft-prep toolkit.

## 2026-08-09 — League Brain (v3): manager profiling on the Dashboard
A "GM scouting report" for the whole league — per-team profiles + league superlatives — answering the
manager-behavior questions (who hoards RBs, drafts QBs early, waits on TE, has the most capital/best
keepers/most trades/most value, who's rebuilding vs contending). Interpretation calls, stated in-UI so
nothing is presented as fact it isn't:
- **"Drafts QBs early" = auction $ SHARE by position.** This is an auction keeper league with a 1-round
  rookie draft, so veterans have no snake-draft "early." Tendency = share of auction dollars spent per
  position, **pooled across every auction season** in the chain (more seasons = steadier), **excluding
  carried keepers** (a keeper's salary isn't a draft-day decision). A team with no observed auction spend
  gets a BLANK tendency (we never fabricate one). The UI shows a confidence note ("pooled over N seasons").
- **Trade count** = completed `type==="trade"` transactions a roster was party to, across ALL seasons
  (roster_id is stable in this league). Required adding `roster_ids` to `RawTransaction` (read-only).
- **Contender index (0–100)** = min-max-normalized blend, ready-to-win-now weighting: rosterValue 0.30,
  keeperSurplus 0.30 (cheap studs = cap room), lastSeasonWins 0.25, small veteran nudge 0.15 (older roster
  = win-now urgency, not rebuild). Archetype layers rebuild signals on top (youth via `years_exp` + rookie
  capital): top third → contender/win-now, bottom third → rebuilding/retooling, else balanced.
- **Value-dependent** (value/surplus/index shift with the source dropdown) → baked per source like
  tiers/scarcity. Pure `computeLeagueBrain` does all league-relative math; `loadLeagueBrain` is the glue.
  Humor is deterministic (template per dominant tag) — the workflow runtime forbids `Math.random`, and
  determinism keeps snapshots stable. Future ideas (volatility, age cliffs, cap flex, FAAB, trade network,
  regret, power ranking, trend) logged in specs/league-brain.md, not built.

## 2026-08-09 — League Brain v3.1: volatility, age cliffs, regret index
Three signals added to the Brain, each source-independent (they ride the per-source bake but don't change
with the value dropdown):
- **Volatility** reuses the drilldown's `gradePlayer` on last season's weekly log — a rostered skill player
  counts toward volatility if their archetype is boom-bust or one-week-wonder, requiring ≥8 logged weeks so
  a thin sample can't label a team. Team volatility = volatile / graded (null if none graded).
- **Age cliffs** count rostered RBs with `years_exp ≥ 5` (~age 27+). A blunt but honest proxy (Sleeper gives
  experience, not birthdate); it's a rebuild-vs-win-now nuance, surfaced as a tag/award, NOT folded into the
  contender index (didn't want age double-counted — the index already has a small veteran nudge).
- **Regret index** = for last season's NON-keeper auction buys (attributed to the buyer via draft
  `picked_by`, not current owner), Σ max(0, paid − VORP-worth-from-actual-production). VORP worth comes from
  `loadValues(ctx,"vorp",data.points)` regardless of the active source, so "deserved" = what last season's
  real points were worth in this league's auction economy. Paid pre-season vs earned = realized remorse, not
  a projection. The floor-y nature of auction VORP (only ~starters clear $1) means an expensive buy who
  finished outside startable range reads as a near-total bust — intended, and the blurb states the earned $.

## 2026-08-10 — Mobile design system, PRs 3–5: four judgement calls
Rolling out `design_handoff_mobile_design_system/TASKS.md`. Four places where the plan needed a call:

- **`table.grid { display:block; overflow-x:auto }` is NOT deleted yet**, though task 5.1 says to. PR5
  converts two lists (keeper board, Targets) to rows; PRs 6 and 7 convert the other seven. Deleting the
  rule now would put five un-migrated tables into **page-level horizontal scroll** — a violation of the
  handoff's own mobile invariant 5 ("no horizontal scrolling anywhere"), which outranks a line item.
  What 5.1 actually targets is *nested* scroll containers, and that is fixed: `.table-scroll` lost its
  `65vh` cap and its `overflow`, so a list now has exactly one scroller instead of two. **Delete the rule
  in PR 6.4**, when Trades — the last table-based list — becomes rows.
- **Scroll lock is `position:fixed`, not `overflow:hidden`.** Measured on this app: `body{overflow:hidden}`
  left **342px** of viewport scroll behind an open sheet, because the clipped body still has a scroll
  range. The sheet freezes body at its offset and restores it on close. Costs a `window.scrollTo` on
  dismiss; the alternative silently fails the "page behind never scrolls" criterion.
- **Mobile-vs-desktop list rendering is a JS hook (`useIsDesktop` in `ui.tsx`), not duplicated markup
  behind a media query.** Rendering both a table and a row list for 40 targets and hiding one is wasted
  DOM. The hook listens to the MediaQueryList **and** `window.resize` — device emulation (and iPad split
  view) resizes without dispatching the former, which cost a debugging round here.
- **The sim bar carries cap-left, not just cap-used.** Task 5.2 says cap-used and sim-surplus move into
  the bar while cap-left and keeping get the display step, but its own acceptance criteria require cap
  left to "stay on screen while scrolling the roster" and over-cap to "flip the bar to the danger role" —
  which only works if cap left is in the bar. Resolved by putting both display-step numbers (cap left,
  keeping) in the bar with used/surplus as its meta line, and dropping the now-redundant stat cards on
  mobile. Desktop keeps all four cards unchanged.

Two bugs from the earlier PRs were found by measuring in-browser and fixed in PR5: the `.toolbar`
full-width rule stretched checkboxes to 265x13, and `input[type=checkbox] { height:auto }` left every
checkbox at its intrinsic 13px rather than the specified 24px — including the ones the keeper simulator
is entirely driven by.

## 2026-08-12 — Repo cleanup: what was deleted, and why `docs/` was safe to delete

A cruft pass. Three of the calls were not obvious:

- **`docs/` was 493 KB of dead build output, despite the Pages API still naming it.**
  `GET /repos/:owner/:repo/pages` reports `"source": {"branch":"main","path":"/docs"}`, which reads
  like the site is served from that folder. It is not: the same response says
  `"build_type": "workflow"`, and that is what governs. `refresh.yml` builds and hands `web/dist`
  straight to `actions/upload-pages-artifact` in one job. The `source` field is a leftover from the
  original manual setup that GitHub keeps returning. Confirmed with `git log -- docs/`: one commit,
  the initial one, never touched since — the deployed site had moved on months of commits ago.
  `web/pagesApp.zip` was the same build zipped for manual upload (byte-identical asset hashes).
- **The phantom `docs/league-rules.md` is gone, not written.** Nine places referenced it — including
  two that printed it to the user (`sgm rulebook` and the web Rules page) — and it has never existed
  in git history. Since every rule is already transcribed in `core/src/config/league-rules.ts` and
  rendered by `sgm rulebook`, a second human-readable copy would be a thing to keep in sync for no
  gain. The config file is now stated as the single source of truth everywhere.
- **The `placeholder` machinery stays even though nothing is a placeholder.** Both §6.1 and §6.4 are
  `placeholder: false` now, so `outstandingRules()` returns empty and the OUTSTANDING banner never
  prints. Kept anyway: it is the guard that stops a future guessed rule from passing for fact. Only
  the docs claiming the rules are *currently* open were corrected.

Retired as finished: `tasks.md` (T01–T24, all shipped, and still marking T12–T21 as blocked on a rules
doc that has long since arrived) and the design handoff bundle (rollout complete at 7/7 PRs; the three
`.dc.html` phase docs plus `support.js` were rendered duplicates of the markdown, and `tokens.css` was
already pasted into `styles.css`). The one living file, its README, became `specs/design-system.md`,
next to `draft-toolkit.md` and `league-brain.md`.

Dated entries above this one still mention the deleted paths. Left alone on purpose — this file is an
append-only log of what was decided when, and editing old entries to match today's tree would make it
lie about its own history.
