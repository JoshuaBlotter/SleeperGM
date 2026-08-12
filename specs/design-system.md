# SleeperGM mobile design system

> **Status: shipped.** This began as a design handoff and was rolled out over 7 PRs, all on `main`.
> It is now the **reference spec for the system as built** — everything below describes what
> `web/src/styles.css` and the shared primitives actually do. Reuse it; don't reinvent it. The
> judgement calls made during the rollout are in `DECISIONS.md`; `CLAUDE.md` carries the short version.

## Overview

SleeperGM is a fantasy-football league management web app (React + TypeScript + Vite, deployed as a static build). It is used almost exclusively on phones at 390–430px wide, but its CSS was written desktop-first and its UI grew organically: 28 distinct colors, 14 font sizes, 21 spacing values, 10 button treatments, three separate toggle-group implementations, and zero focus styles.

This was a **standardization pass**, not a rebrand: one token set, one canonical version of each core component, and a mobile-first layout. Every color in the token set already existed in `web/src/styles.css`.

## Environment

**React 18 + TypeScript, Vite, plain CSS in a single `web/src/styles.css` with CSS custom properties, no CSS framework, no component library.** Work in that idiom — CSS variables and semantic class names in `styles.css`, small typed React components in `web/src/`. Do not introduce Tailwind, CSS-in-JS, or a component library; the standardization exists to reduce moving parts, not add them. `lucide-react` is the one approved UI dependency, for the icon set that replaced the old emoji and glyph characters.

## Fidelity

**High fidelity.** Colors, type sizes, weights, spacing, radii and control heights in this document are final and exact.

Two things are deliberately *not* pinned: icon choice (any sensible Lucide glyph is fine) and exact copy for new microlabels.

## Design tokens

Declare all of these in `:root` in `web/src/styles.css`. Nothing outside `:root` should contain a raw hex, rgba, px font-size, px spacing value, or px radius.

### Color — 4 semantic roles × 4 steps

Each role has `tint` (fill behind text), `line` (border), `base` (the color itself), `soft` (text on tint).

| Role | tint | line | base | soft |
|---|---|---|---|---|
| accent | `#23324d` | `#35507d` | `#4c8dff` | `#7fb0ff` |
| success | `rgba(55,209,122,0.15)` | `#2a5c40` | `#37d17a` | `#5fe0a0` |
| warning | `rgba(255,180,84,0.15)` | `#6b5a2e` | `#ffb454` | `#ffc677` |
| danger | `rgba(255,107,107,0.15)` | `#6b2e2e` | `#ff6b6b` | `#ff8f8f` |

```css
--accent-tint:#23324d;  --accent-line:#35507d;  --accent:#4c8dff;  --accent-soft:#7fb0ff;
--success-tint:rgba(55,209,122,0.15);  --success-line:#2a5c40;  --success:#37d17a;  --success-soft:#5fe0a0;
--warning-tint:rgba(255,180,84,0.15);  --warning-line:#6b5a2e;  --warning:#ffb454;  --warning-soft:#ffc677;
--danger-tint:rgba(255,107,107,0.15);  --danger-line:#6b2e2e;  --danger:#ff6b6b;  --danger-soft:#ff8f8f;
```

### Color — neutrals

```css
--bg:#0e1116;          /* page */
--surface:#171b22;     /* cards, controls */
--surface-2:#1e242d;   /* raised: segmented track, stat wells, chip fills */
--line:#2a3039;        /* container borders */
--line-soft:#20252e;   /* row dividers — quieter on purpose */
--text:#e6e9ee;
--text-muted:#8b95a3;
--scrim:rgba(0,0,0,0.6);
```

24 tokens total. Every one of these values is already in the codebase — this is a rename, not a recolor.

**Mapping from today's tokens:** `--panel` → `--surface`, `--panel-2` → `--surface-2`, `--border` → `--line`, `--dim` → `--text-muted`, `--accent-dim` → `--accent-tint`, `--pos` → `--success`, `--neg` → `--danger`, `--amber` → `--warning`. The bare hexes `#20252e`, `#35507d`, `#2a5c40`, `#6b2e2e`, `#6b5a2e` and the four `.pos-*` text colors become the `line` and `soft` steps above.

**One normalization:** there are currently two amber tints, `rgba(255,180,84,0.15)` and `rgba(255,180,84,0.16)`. They are visually identical; standardize on `0.15`.

### Type — 8 steps

| Token | Size | Line-height | Weight | Used for |
|---|---|---|---|---|
| `--text-display` | 30px | 1.15 | 700 | the one number a screen is about |
| `--text-title` | 22px | 1.25 | 700 | screen title, sheet title, stat well values |
| `--text-heading` | 17px | 1.35 | 600 | section headings, row trailing metric |
| `--text-body` | 15px | 1.5 | 400 | body copy, row titles (600 when a name) |
| `--text-control` | 16px | 1 | 600 | **all** buttons, inputs, selects |
| `--text-label` | 13px | 1.4 | 600 | dense secondary labels |
| `--text-caption` | 12px | 1.45 | 400 | meta lines, helper text |
| `--text-micro` | 11px | 1.3 | 700 | uppercase microlabels, `letter-spacing:0.05em` |

Font family is unchanged: the system stack already on `body`. Letter-spacing: `-0.02em` on display, `-0.01em` on title, `0.05em` on micro, `0` elsewhere.

**Weights collapse to 400 / 600 / 700.** Weight `650` (currently 8 rules) does not exist in the system font stack — browsers round it to 700. Weight `500` maps to 400.

**Sizes 9px and 10px are retired entirely.** 11px (micro) is the floor.

**16px on every form control is non-negotiable.** iOS Safari auto-zooms any focused `input`/`select`/`textarea` under 16px and leaves the page zoomed. All controls are 13px today; this single rule is the highest-value line in the whole system.

### Spacing — 4pt scale

```css
--space-1:4px;   /* icon ↔ label */
--space-2:8px;   /* chip gap, adjacent-target minimum */
--space-3:12px;  /* row padding */
--space-4:16px;  /* card padding, screen gutter */
--space-5:20px;  /* block gap */
--space-6:24px;  /* section gap */
--space-7:32px;  /* screen top */
--space-8:48px;  /* screen bottom */
```

Replaces 21 ad-hoc values (every integer 1–10, plus 12–15, 18, 20, 22, 24, 40, 60).

### Radius

```css
--radius-sm:6px;    /* controls, inputs, buttons */
--radius-md:10px;   /* cards, segmented track, wells */
--radius-lg:14px;   /* sheet top corners */
--radius-full:999px;/* chips, pills */
```

Replaces 9 values (3, 4, 5, 6, 8, 10, 12, 14, 999).

### Size & layout

```css
--control-h:44px;     /* default — every tappable control */
--control-h-lg:52px;  /* tab bar item, sheet header, top bar */
--control-h-sm:36px;  /* desktop only, or nested inside a 44px hit area */
--row-h:64px;         /* row card minimum */
--topbar-h:52px;      /* top bar — 68px on desktop, where the bar gains 16px of padding */
--ctx-h:61px;         /* context strip */
--avatar:32px;        /* team avatar, brand mark */
--avatar-lg:48px;     /* player headshot in the drilldown */
--safe-b:env(safe-area-inset-bottom);
--bp-desktop:760px;   /* the only breakpoint */
```

`--topbar-h` and `--ctx-h` are **fixed heights, not measurements**: three bars stick to the top of the
page (top bar → context strip → list bar) and each one is offset by the sum of the heights above it.
A bar shorter than the offset the next one uses leaves a transparent band that the page scrolls
through in plain view. So the bar sets `min-height` from the token, every offset below is computed
from the same token, and each offset subtracts 1px so the bars overlap by a hairline rather than
risking a gap on a fractional device-pixel ratio.

## Mobile invariants

These apply to every task. A task is not done if it violates one.

1. **44px minimum touch target**, 8px minimum gap between adjacent targets.
2. **16px minimum font-size on form controls.**
3. `viewport-fit=cover` on the meta tag; `env(safe-area-inset-*)` respected on the tab bar and every sheet.
4. Primary navigation and destructive actions live in the **bottom third** of the screen.
5. **No horizontal scrolling anywhere**, and no nested scroll containers.
6. CSS is **mobile-first**: base rules are the phone; one `@media (min-width:760px)` block adds the desktop layer.
7. Test at 390px and 430px in a real mobile browser, not just devtools.

## Components

### Button — `.btn` with 4 variants

Replaces 10 current treatments (`nav button`, `.refresh`, `.subtabs button`, `.subtabs-btn`, `.link`, `.plink`, `.tier-chip`, `.brain-card`, `.modal-close`, `.ov-edit`/`.ov-reset`).

- Base: height `--control-h` (44px), padding `0 --space-4`, radius `--radius-sm`, font `--text-control` (16px/600), no text-transform.
- **Primary**: `background:--accent`, `color:--bg`, no border. For the single most consequential action on a screen.
- **Secondary**: `background:--surface`, `1px solid --line`, `color:--text`. The default.
- **Ghost**: transparent, `color:--text-muted`, no border. Tertiary/dismissive actions.
- **Icon**: 44×44 square, otherwise secondary. Contains a 20–24px icon only.
- `.btn-block`: `width:100%` — the default form for a primary action on mobile.
- Hover: one surface step up (`--surface` → `--surface-2`); primary lightens to `--accent-soft`.
- Active/pressed: `--accent-line` for primary, `--surface-2` for secondary.
- Disabled: `opacity:0.45`, `pointer-events:none`.
- Focus-visible: `outline:2px solid --accent; outline-offset:2px`.

There is currently **no primary button in the app at all** — `.refresh` doubles as both the refresh button and the `<select>` rule. Splitting these is part of the work.

`.plink` (player name, the most-tapped control in the app — it opens the drilldown) keeps its inline text appearance but must get a ≥44px hit area, e.g. via padding on the containing row zone rather than by growing the text.

### Segmented control — `.seg`

One implementation replaces `nav button` (top tabs), `.subtabs` (Team/Players/Tiers/Market sub-tabs), `.subtabs-btn` (the Tiers position filter), and the Market sort toggle. Note today's state-class split: `.subtabs` uses `.active`, `.subtabs-btn` uses `.on`. Standardize on **one** state class, `.is-on`.

- Track: `background:--surface-2`, `1px solid --line`, `radius --radius-md`, `padding:4px`, `gap:4px`, `display:flex`.
- Option: `flex:1` (equal width), height `--control-h-sm` (36px), radius `--radius-sm`, font 15px/600, `color:--text-muted`.
- Selected (`.is-on`): `background:--accent-tint`, `color:--text`.
- Total track height is 44px (36 + 2×4 padding), satisfying the touch minimum.
- Full-bleed to the screen gutters on mobile.

Six call sites: Team, Players, Tiers ×2, Market ×2.

### Input / select / checkbox — `.input`

Collapses three current definitions (`select`+`.refresh` at `7px 12px`, `.filters input/select` at `7px 10px`, `.ov-input` at `2px 5px`/r5).

- Height `--control-h` (44px), padding `0 14px`, radius `--radius-sm`, `background:--surface`, `1px solid --line`, font `--text-control` (**16px**).
- `select` no longer shares a rule with any button.
- Placeholder: `--text-muted`.
- Focus-visible: the global accent ring.
- Checkbox: 24×24 inside a 44px-tall row, `accent-color:--accent`, label at 16px, `gap:--space-3`. The keeper simulator is driven entirely by these.
- Error state: `border-color:--danger`, message at `--text-caption` in `--danger`.

The Worth override cell (`.ov-edit`) currently reveals a dashed border **on hover only**, which never fires on a phone — the editable cell is invisible as a control. It needs a permanent affordance.

### Chip — `.chip`, 3 variants

One primitive absorbs `.badge`, `.arch-pill`, `.pill-active`, `.tag-chip`, `.why-chip`, `.need-pill`, `.finish-chip`, `.cost-pill`, `.tier-chip` (10 styles, 6 paddings, 5 font sizes).

- Base: `padding:4px 10px`, radius `--radius-full`, font `--text-caption` (12px), weight 600.
- **Solid** — status: `background:<role>-tint`, `color:<role>`. keep / hold / cut, archetypes, need levels.
- **Outline** — position: `transparent`, `1px solid <role>-line`, `color:<role>-soft`, weight 700. QB→danger, RB→success, WR→accent, TE→warning.
- **Neutral** — meta: `background:--surface-2`, `1px solid --line`, `color:--text-muted`.
- **Interactive chips are 44px tall** and otherwise identical. Shape now signals tappability — today `.tier-chip` is a button that looks exactly like the static `.tag-chip`.

Why position chips move to outline: QB currently uses the same red as the "cut" badge, on the same fill treatment. A red QB chip reads as a cut recommendation. Same colors, different shape, no collision.

### Row card — `.row`

**Replaces every table on mobile.** Today `table.grid` is `display:block; overflow-x:auto` with `white-space:nowrap` on every cell; the keeper board needs ~640px on a 390px screen, so Surplus and Call — the entire point of the screen — are off-canvas.

Three zones, `min-height:--row-h` (64px), `padding:--space-3 --space-4`, `gap:--space-3`, divider `1px solid --line-soft`:

1. **Leading** (flex:none) — checkbox, rank number, or avatar. Optional.
2. **Title block** (flex:1, min-width:0) — line 1: name at 15px/600 plus an outline position chip; line 2: meta at `--text-caption` in `--text-muted`, values joined by ` · `. Truncate with ellipsis; never more than two lines collapsed.
3. **Trailing** (flex:none, text-align:right) — the metric the screen is *about* at `--text-heading` (17px/700) in a role color, with a `--text-micro` label beneath.

- Optional expander: tapping the row reveals remaining columns as a key/value grid.
- Tapping the **name** opens the player drilldown; tapping elsewhere in the row expands it.
- Selected/kept state: `background:rgba(76,141,255,0.07)` (an existing value).
- Above 760px, lists may still render as the current table.

### Bottom tab bar

Replaces the mobile `<select>` navigation. Today the header is `position:sticky` on desktop and explicitly `static` on mobile — so on the only viewport that matters, navigation scrolls away entirely.

- `position:fixed; bottom:0`, full width, `background:--surface`, `border-top:1px solid --line`, `padding-bottom:--safe-b`.
- 5 items, `flex:1`, height `--control-h-lg` (52px): icon 22–24px above an 11px/700 label.
- Selected: `--accent` icon + label, `--accent-tint` icon background. Unselected: `--text-muted`.
- Destinations: **Home · Team · Market · Players · More**. Tiers, Rookies and Rules move behind **More**, which opens a sheet.
- App body needs matching bottom padding so content is never hidden beneath the bar.
- Above 760px, revert to the current horizontal tab row in the header.

### Context strip

A sticky strip beneath a 52px top bar, carrying only the controls that change *what you are looking at*: the team picker and the value-source picker, as chips that open picker sheets. The team chip shows only on Team and Trades, as today. Replaces `.nav-select`.

### Sheet

Replaces the centered `.modal` (currently `6vh 16px` padding, `max-height:86vh`, a 27px `✕` in the top-right — the hardest point on a phone to reach — with no focus trap, no scroll lock, no safe-area padding).

- Bottom-anchored, `radius --radius-lg` on top corners only, `background:--surface`, `max-height:92vh`.
- 36×4px drag handle, `--line` color, centered, 8px top padding.
- Sticky header: title at `--text-title`, meta line at `--text-caption`, and a 44px `.btn-icon` close on the right.
- Body scrolls; **page behind is scroll-locked**; focus is trapped; Escape, scrim tap and swipe-down all dismiss; focus returns to the trigger on close.
- `padding-bottom:--safe-b`.
- Scrim: `--scrim`.
- Above 760px, render as the current centered dialog.

### Card

`.card`, `.info-card`, `.brain-card`, `.tier-band` and `.notice` currently share a background and border but use four different paddings (14/16, 13/15, 12/13, 8/10) and three radii. Collapse to one base: `background:--surface`, `1px solid --line`, `radius --radius-md`, `padding:--space-4`. Variants add only an accent border-color or a 3px left accent border.

`.card.highlight` is the app's only gradient; keep it as the single exception or drop it — implementer's call.

### Avatar — `.avatar`, `.pavatar`

Remote imagery from Sleeper's public image CDN (`sleepercdn.com`) — manager avatars on the Dashboard
rows and the Team heading, a player headshot in the drilldown. Three URL shapes: `/avatars/thumbs/{id}`,
`/content/nfl/players/thumb/{playerId}.jpg`, `/images/team_logos/nfl/{code}.png`.

- One box, two states. `.avatar` is a `--radius-full` disc at `--avatar` (or `--avatar-lg`); the
  `.is-fallback` state is an initials disc of **identical size**. Every one of these images can 404 —
  a manager who never set an avatar, a player Sleeper has no headshot for — and a fallback that
  changed size would reflow the row. Never render one of these images without the fallback.
- `.is-logo` switches `object-fit` to `contain`: a team logo is artwork with its own margins and must
  not be cropped to the circle. A defense has no headshot, so its logo *is* the portrait.
- `.pavatar` overlays the NFL team logo on the headshot's bottom-right corner as a 20px badge.

### Medal — `.medal`

A `--control-h-sm` rounded square holding one Lucide glyph, tinted by one of the four color roles
(`.is-accent` / `.is-success` / `.is-warning` / `.is-danger`), sitting inside an `.info-card` heading.
It exists so a deck of award cards is scannable by verdict. **Not a control** — it is never tappable,
which is why it is not a `.chip`.

## Focus & accessibility

The current stylesheet contains **no `:focus` or `:focus-visible` rule at all** across 17.6KB, and every custom button sets `border:0` on a transparent background. Add one global rule:

```css
:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
```

Also missing today and in scope: disabled styling (the Refresh button is rendered `disabled` while in flight but looks identical — only its label changes to "…"), loading states, and the modal focus trap.

## State management

No state architecture changes. State lives in `App.tsx` (active tab, selected team, value source, refresh status) and `keptStore.ts` (the kept set and worth overrides, persisted). Two additions:

- Sheet open/close state, with the trigger element retained for focus return.
- Per-row expanded state in row lists (local component state, not persisted).

The kept set must continue to feed the Targets screen, and worth overrides must continue to persist, unchanged.

## Assets

Icons are **Lucide** (`lucide-react`), 24px, stroke width 1.5, colored via `currentColor` — they replaced the emoji and glyph characters (🏈 28px logo, 🧠, ✕, ↻, ↺, ▸/▾, ▲/▼, ⚠, →) that had no consistent size, weight or optical alignment and rendered in full color regardless of context. The `†` and `≈` salary annotation marks stay — they are data notation, not icons.

Two image assets, both added after the original rollout:

- **`web/public/logo.svg`** — the only local one. It is the browser favicon *and* the `.brandmark` in the top-left of the header, deliberately the same file so the two cannot drift. A favicon cannot read custom properties, so its four colors are literal copies of `--surface`, `--line`, `--accent` and `--bg`; keep them in sync if those tokens move.
- **Sleeper CDN imagery** — team avatars and player headshots, loaded at runtime. See `.avatar` above; each one is remote, optional and always paired with a fallback.

## Source files this affects

```
web/index.html              viewport meta
web/src/styles.css          all tokens, all component rules — the main file
web/src/App.tsx             shell, nav, context strip, pickers
web/src/ui.tsx              shared Call/Money/Pos helpers
web/src/PlayerModal.tsx     → becomes sheet content; 7 inline style objects to remove
web/src/Sheet.tsx           NEW
web/src/Row.tsx             NEW
web/src/views/Dashboard.tsx
web/src/views/Team.tsx      keeper board — the hardest screen
web/src/views/Players.tsx
web/src/views/Targets.tsx
web/src/views/Tiers.tsx
web/src/views/Inflation.tsx  (Market)
web/src/views/Rookies.tsx
web/src/views/Trades.tsx
web/src/views/Rules.tsx
```

There are ~25 inline `style={{...}}` objects scattered across the views (7 in `PlayerModal.tsx` alone, and `style={{ marginTop: 0 }}` copy-pasted across 6 views). All should be gone by the end of PR 7.
