# Rollout — 7 PRs, 23 tasks

Ordered so every PR is independently shippable and nothing is ever half-migrated in `main`. Work them in order.

**Applies to every task:** test at 390px and 430px in a real mobile browser, not just devtools. No task is done if it introduces a horizontal scrollbar, a control under 44px, or a form control under 16px. Run `npm run check` before each merge; the static build (`npm run web:static`) must still render, since that is the deployed path.

Sizes: S ≈ 1–2h · M ≈ half a day · L ≈ a full day.

---

## PR 1 — Foundation · M
**Name everything. Change nothing.** Pure find-and-replace plus a media-query flip. Ship first and independently — if the visual diff is not empty, something is wrong.

### 1.1 Semantic color tokens · S
Rewrite `:root` as four roles × four steps plus eight neutrals (see `tokens.css`). Replace all 9 hard-coded hexes and all 15 rgba() literals with the new variables. `--accent-dim` → `--accent-tint`; `--pos`/`--neg`/`--amber` → `--success`/`--danger`/`--warning-*`. Normalize the 0.16 amber tint to 0.15.

**Files:** `web/src/styles.css`

**Done when:**
- `grep -E "#[0-9a-f]{6}|rgba\(" web/src/styles.css` returns only lines inside `:root`
- Screenshots of all 8 tabs before/after are pixel-identical
- Token count is 24; no variable is unused

### 1.2 Type, space and radius scales · M
Add the type, space, radius and size tokens. Map every existing rule onto the nearest step — this is where 14 font sizes become 8 and 21 spacing values become 8. Drop weight 650 → 700 and 500 → 400. Body 14 → 15px.

**Files:** `web/src/styles.css`

**Done when:**
- No raw `font-size`, `padding`, `margin`, `gap` or `border-radius` px value outside `:root`
- 9px and 10px no longer appear anywhere
- Layout shifts are ≤2px per element; nothing reflows or wraps differently

### 1.3 Invert to mobile-first · M
Move the contents of the two `max-width` queries into the base rules; put the desktop layer in a single `@media (min-width: 760px)` block. Retire the 800px breakpoint — `.two-col` now matches everything else.

**Files:** `web/src/styles.css`

**Done when:**
- Exactly one media query remains in the file
- Disabling CSS media queries entirely yields the mobile layout, not the desktop one
- 761–799px renders as desktop, not half-collapsed

### 1.4 Viewport, safe area, focus ring · S
Add `viewport-fit=cover` to the meta tag, `-webkit-text-size-adjust:100%` to body, and one global `:focus-visible` rule (2px accent outline, 2px offset). Add `--safe-b: env(safe-area-inset-bottom)`.

**Files:** `web/index.html`, `web/src/styles.css`

**Done when:**
- Tabbing through any screen shows a visible accent ring on every control
- Mouse clicks never show the ring
- Rotating an iPhone to landscape leaves no unpainted notch band

---

## PR 2 — Controls · L
**10 button styles → 4; 10 chips → 3.**

### 2.1 `.btn` — primary / secondary / ghost / icon · M
Add the `.btn` family with hover/active/disabled states and `.btn-block`. Migrate call sites: Refresh → `.btn-secondary`; "Reset to recommended" → `.btn-secondary .btn-block`; "View →" and "Reset all" → `.btn-ghost`; `.modal-close` → `.btn-icon`. Delete `.refresh` and `.link`. Give `.plink` a 44px hit area without changing its type. Wire the disabled state on Refresh.

**Files:** `styles.css`, `App.tsx`, `views/Team.tsx`, `views/Dashboard.tsx`, `PlayerModal.tsx`

**Done when:**
- No `className="refresh"` or `className="link"` anywhere
- Every `<button>` measures ≥44×44 in devtools, player names included
- Refresh visibly dims while in flight

### 2.2 `.seg` — one segmented control · M
One implementation replacing `.subtabs`, `.subtabs-btn` and the Market sort toggle. Equal-width, full-bleed on mobile; one state class (`.is-on`) — the `.active`/`.on` split dies here. Six call sites: Team, Players, Tiers ×2, Market ×2.

**Files:** `styles.css`, `views/Team.tsx`, `views/Players.tsx`, `views/Tiers.tsx`, `views/Inflation.tsx`

**Done when:**
- `.subtabs` and `.subtabs-btn` are deleted from the stylesheet
- The Tiers position filter and the Team sub-tabs look identical
- Track is 44px tall; options never wrap at 390px

### 2.3 Form controls at 16px / 44px · S — **highest value per line changed**
Collapse the three input definitions into one `.input` rule; `select` stops sharing a rule with a button. Checkboxes to 24px in a 44px row. `.ov-input` gets the same treatment, and the Worth cell gets a permanent affordance instead of a hover-only dashed border.

**Files:** `styles.css`, `views/Players.tsx`, `views/Inflation.tsx`, `views/Team.tsx`

**Done when:**
- Focusing the player search on a real iPhone does **not** zoom the page
- Every checkbox is tappable without precision
- The editable Worth cell is identifiable as editable without hovering

### 2.4 `.chip` — solid / outline / neutral · M
One primitive absorbs `.badge`, `.arch-pill`, `.pill-active`, `.tag-chip`, `.why-chip`, `.need-pill`, `.finish-chip`, `.cost-pill` and `.tier-chip`. `.pos` becomes the outline variant so a QB chip cannot read as a "cut" badge. Interactive chips get 44px height.

**Files:** `styles.css`, `ui.tsx`, all 9 views, `PlayerModal.tsx`

**Done when:**
- Three chip rules in the stylesheet, one padding value between them
- Tappable chips are visibly taller than static ones
- `Call` in `ui.tsx` renders the shared chip

---

## PR 3 — Shell · M
**Nav that is always under your thumb.**

### 3.1 Bottom tab bar · M — **high value**
Fixed bar: Home · Team · Market · Players · More. Tiers, Rookies and Rules move behind More. 52px items plus `--safe-b`; app body gets matching bottom padding so nothing hides under it. Add Lucide (`lucide-react`, 24px, stroke 1.5) and drop the 🏈 / 🧠 emoji for a wordmark. Desktop keeps the horizontal tab row.

**Files:** `App.tsx`, `styles.css`, `web/package.json`

**Done when:**
- Nav is reachable from any scroll position on every screen
- Bottom content is never obscured, including at the end of the Players list
- No item label wraps at 390px; the bar clears the iOS home indicator

### 3.2 Context strip · S
Sticky strip under a 52px top bar carrying only the two controls that change what you are looking at: team and value source, as chips that open pickers. The team chip shows only on Team and Trades, as today. Delete `.nav-select`.

**Files:** `App.tsx`, `styles.css`

**Done when:**
- Strip stays visible while scrolling any list
- Switching source still recomputes worth, surplus, inflation and trades
- `.nav-select` is gone from CSS and JSX

### 3.3 Retire the reused layout classes · S
`.controls` is a header element used inside the Trades body, and `.needs` (a pill row) holds buttons and checkboxes on Team. Replace both with a generic `.toolbar` that stacks full-width on mobile.

**Files:** `styles.css`, `views/Trades.tsx`, `views/Team.tsx`, `views/Targets.tsx`

**Done when:**
- `.controls` appears only in the app shell
- `.needs` contains only need pills
- No inline `marginLeft:"auto"` remains

---

## PR 4 — Sheet · M
**The drilldown, and every picker.**

### 4.1 Sheet primitive · M
New `Sheet.tsx`: bottom-anchored, drag handle, sticky header with a 44px close, body scroll lock, focus trap, Escape + scrim tap + swipe-down to dismiss, safe-area bottom padding. Above 760px it renders as today's centered dialog. Replaces `.modal-backdrop` / `.modal`.

**Files:** new `web/src/Sheet.tsx`, `styles.css`, `PlayerModal.tsx`

**Done when:**
- The page behind never scrolls while a sheet is open
- Tab cycles inside the sheet only; Escape closes and returns focus to the trigger
- Close button is reachable one-handed on a 6.1" phone

### 4.2 Player drilldown content · M
Grade badge + archetype merge into one banner. The eight-item stat run becomes a 3-column grid at the title step. Chart to 160px, labels every third week at the micro step (9px is retired), legend prose becomes three chips. Delete the seven inline style objects.

**Files:** `PlayerModal.tsx`, `styles.css`

**Done when:**
- Every number is legible at arm's length on a phone
- Missing weeks still render as gaps with correct week numbers
- Zero `style={` attributes left in the file

### 4.3 Picker sheets · S
Team, value-source and More open as sheets with 44px rows and a checked state, instead of native `<select>` menus. Keep a native fallback on desktop.

**Files:** `App.tsx`, `Sheet.tsx`, `views/Trades.tsx`

**Done when:**
- Every picker row is ≥44px and shows the current selection
- 12 teams fit without the list feeling cramped
- Keyboard selection still works on desktop

---

## PR 5 — Row card + Keepers · L
**Prove the pattern on the hardest screen.**

### 5.1 `.row` primitive · M
Three zones — leading control, title block (name + position + meta line), trailing metric with a micro label — at a 64px minimum, plus an optional expander revealing the remaining columns as a key/value grid. Below 760px lists render as rows; above, as today's table. Delete `table.grid { display:block; overflow-x:auto }` and the `65vh` cap on `.table-scroll`.

**Files:** `styles.css`, new `web/src/Row.tsx`

**Done when:**
- No nested scroll containers anywhere
- Long names truncate with an ellipsis; the row never grows past two lines collapsed
- Tapping the row expands; tapping the name opens the drilldown

### 5.2 Keeper board + sticky sim bar · L — **high value**
The 8-column board becomes rows: checkbox · name + position + `keep $ / worth / acquired` meta · surplus + call. Cap-left and keeping get the display step; cap-used and sim-surplus move into a sticky sim bar above the tab bar that also carries "Reset to recommended". Keep the `†` / `≈` salary marks and the kept-row tint.

**Files:** `views/Team.tsx`, `Row.tsx`, `styles.css`, `keptStore.ts` (read-only)

**Done when:**
- Surplus and the keep/cut call are visible without scrolling sideways
- Cap left updates live and stays on screen while scrolling the roster
- Over-cap flips the bar to the danger role
- The kept set still feeds Targets; overrides still persist

### 5.3 Targets · M
Same row treatment: rank + name + position, worth as the trailing metric, the "why" chips on the meta line (capped at two, rest behind the expander). Need pills and the "assume everyone available" toggle move into the toolbar.

**Files:** `views/Targets.tsx`, `Row.tsx`

**Done when:**
- 40 targets scroll smoothly with no layout jank
- Why-chips never wrap to a third line collapsed
- Scoring output is unchanged from before the PR

---

## PR 6 — Remaining lists · L
**Mechanical once 5.1 exists.**

### 6.1 Players — All + Trending · M
Rows with last-season points as the trailing metric. The four filters collapse into a sticky search field plus a "Filters" chip that opens a sheet, with an active-filter count. Sortable headers become a sort chip in the same sheet.

**Files:** `views/Players.tsx`, `Sheet.tsx`, `Row.tsx`

**Done when:**
- Filters never occupy more than one row above the list
- Result count stays visible
- Sort direction is clear without a table header

### 6.2 Market — Inflation · Scarcity · Last-year auction · M
Both two-col tables become rows; `.two-col` stacks by default. Scarcity cards keep their bars but adopt card tokens; the `.scar-row` reveal becomes an expander. Stat cards drop to two per screen.

**Files:** `views/Inflation.tsx`, `Row.tsx`, `styles.css`

**Done when:**
- No horizontal scroll on any of the three sub-tabs
- Δ and its percentage stay on one line
- Scarcity bars read correctly at 390px

### 6.3 Tiers + Rookies · M
Tier chips adopt the interactive chip (44px) and tier bands adopt card tokens. Rookies: the prospect grid becomes rows; the pick board and capital tables become rows; the base-order reveal keeps its `<details>` but gets the new summary styling.

**Files:** `views/Tiers.tsx`, `views/Rookies.tsx`, `Row.tsx`, `styles.css`

**Done when:**
- Tier chips are tappable without precision and still open the drilldown
- Slot-cost pills fit one row per pick
- `.prospect-grid` and its 760px query are deleted

### 6.4 Trades · M
Chips / dead weight / targets become rows. The swap table — give, get, from, my surplus, my cap, fit — becomes a swap card: give above, get below, with the two deltas as trailing metrics. Partner select and the Sharky toggle move into the toolbar.

**Files:** `views/Trades.tsx`, `Row.tsx`, `styles.css`

**Done when:**
- A swap is readable in one glance without scrolling sideways
- Sharky and mutual-fit modes are visually distinct
- Empty states keep their explanatory copy

---

## PR 7 — Dashboard + cleanup · M
**Merge the duplicates, delete the dead CSS.**

### 7.1 Dashboard + Rules · M
Team profiles and the standings table merge into one row list carrying archetype, record and roster value; profile detail moves to the expander. Season and Teams move to the context strip, leaving two stat cards. Award cards, info cards and profile cards collapse onto one card rule. Rules: the two `maxWidth:420` tables become rows; the rookie cost table stays a table with a sticky first column on desktop and a position-segmented view on mobile.

**Files:** `views/Dashboard.tsx`, `views/Rules.tsx`, `Row.tsx`, `styles.css`

**Done when:**
- Twelve teams appear once, not twice
- Tapping a team still opens it
- `.brain-card`, `.info-card` and `.card` share one base rule

### 7.2 Sweep · S
Delete every rule no longer referenced; replace the remaining glyph icons (`↻ ↺ ✕ ▸ ▾ ▲ ▼ →`) with Lucide; remove all remaining inline style objects; add a short "Design system" section to `CLAUDE.md` so future work uses the tokens.

**Files:** `styles.css`, all views, `CLAUDE.md`

**Done when:**
- `grep "style={" web/src -r` returns nothing
- Stylesheet is meaningfully smaller than 17.6KB
- No emoji remain in the UI
- `npm run check` and the static build both pass

---

## If you only ship three

PR 1 (tokens — safe, and everything depends on it), 2.3 (16px form controls — one rule, ends the iOS zoom bug) and PR 3 (bottom nav — the biggest daily improvement). Roughly a day of work, covering most of the felt pain.
