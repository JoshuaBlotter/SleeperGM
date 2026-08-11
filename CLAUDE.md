# CLAUDE.md — working agreement for this repo

This file is auto-loaded by Claude Code. It tells any future agent (me, on another day) how to work
here so the project stays coherent across sessions. Read it first, then read `PROGRESS.md` for current
state.

## What this is
A personal Sleeper fantasy-football GM tool for the keeper/dynasty league **"Los Socios"**
(`LEAGUE_ID=1389689313502961664`). Goals, data model, and rules are in **`spec.md`**; user flows in
**`diagrams.md`**; the task backlog in **`tasks.md`**. Larger per-iteration feature specs live under
**`specs/`** (e.g. `specs/draft-toolkit.md`) so `spec.md` stays lean.

## Golden rules
1. **CLI-first.** All logic lives in `core/` as **pure, side-effect-free functions**. The CLI (`cli/`)
   and any future web layer are thin consumers. Never put business logic in a command handler.
2. **Everything verifiable offline.** Unit tests use tiny hand-written fixtures in
   `core/src/__tests__/fixtures/` — no network in tests. Live calls happen only in `npm run smoke`.
3. **The Sleeper API is read-only, no auth.** Never add write calls, accounts, or secrets.
4. **Two open house rules are faked, not guessed.** Keeper escalation (spec §6.1) and rookie startup
   cost (spec §6.4) are unknown. They live behind `config/league-rules.ts` with `placeholder: true` and
   are surfaced loudly (`sgm rulebook` prints an OUTSTANDING banner). When the real rules doc arrives,
   only that config file + `docs/league-rules.md` should need to change.

## Definition of Done (every code change)
- `npm run check` is green (`typecheck` + `vitest`). This is the gate — if it's green, the change is safe.
- New engine logic ships with unit tests in the same PR/commit.
- If behavior or state changed, update **`PROGRESS.md`**; if a non-obvious decision was made, append to
  **`DECISIONS.md`**.

## Commands
- `npm run check` — typecheck + tests (the self-verification gate)
- `npm test` / `npm run test:watch` — tests
- `npm run smoke` — hit the LIVE Sleeper API, print key facts (catches upstream drift)
- `npm run fixtures` — refresh recorded live snapshots (integration, not unit)
- `npm run sgm -- <command>` — run the CLI, e.g. `npm run sgm -- dashboard`

## Layout
- `core/src/sleeper/` — API client + TTL cache + players resolver
- `core/src/registry/` — team registry (single-team views)
- `core/src/history/` — season chain, auction prices, FAAB, provenance
- `core/src/engines/` — keepers, cap, points, valuation (pure)
- `core/src/config/league-rules.ts` — house rules (with the two placeholders)
- `cli/src/commands/` — one file per command

## Conventions
- TypeScript ESM, extensionless relative imports (moduleResolution: bundler), Node ≥ 22 native `fetch`.
- Raw Sleeper payloads may be typed loosely (`any`/narrow interfaces); **domain outputs are fully typed**
  (see `core/src/types.ts`).
- Money is whole dollars (integers). Player ids are strings. Defenses are team codes ("SF", "DAL").
- Prefer a small pure function + a test over a clever inline. Keep commands boring.

## Design system (`web/`)
The app is used on phones at 390–430px. Everything below is settled — reuse it, don't reinvent it.
Full spec: `design_handoff_mobile_design_system/README.md`; the judgement calls are in `DECISIONS.md`.

**Tokens.** Every color, size, space and radius is a `:root` custom property in `web/src/styles.css`.
Nothing outside `:root` may contain a raw hex, `rgba()`, px font-size, px spacing or px radius. Four
color roles (`accent` / `success` / `warning` / `danger`) × four steps (`-tint` fill, `-line` border,
base, `-soft` text-on-tint), eight neutrals, eight type steps, a 4pt space scale, four radii.

**Primitives — use these, don't add a tenth variant of one.**
- `Row` / `RowList` (`web/src/Row.tsx`) — every list on mobile. Leading control, title block (name +
  position chip, meta line), trailing metric with a micro label, optional expander for the columns a
  table would have shown. `details: {k, v, wide?}[]`; `wide` spans both columns.
- `Sheet` / `PickerSheet` (`web/src/Sheet.tsx`) — every modal and picker. Scroll lock, focus trap,
  focus return, Escape / scrim / swipe dismiss are already handled.
- `.btn` (primary/secondary/ghost/icon), `.seg` (segmented control, state class `.is-on`), `.chip`
  (solid/outline/neutral, `.chip-interactive` when tappable), `.card` (one base rule shared by
  `.info-card`, `.notice`, `.tier-band`, `.swap`), `.toolbar` (control bar inside a view body).

**Invariants.** 44px minimum touch target with 8px between adjacent targets; 16px minimum font-size on
every form control (below that iOS Safari zooms and stays zoomed); mobile-first CSS with exactly one
`@media (min-width: 760px)` block; no horizontal scrolling and no nested scroll containers anywhere.

**Mobile vs desktop.** Lists render as `Row`s below 760px and as tables above, via `useIsDesktop()`
in `web/src/ui.tsx`. Exceptions, both deliberate: rookie prospects and swap cards are the same at
every width.

**Icons are Lucide** (`lucide-react`), 24px, stroke 1.5, colored by `currentColor`. No emoji, no glyph
characters. `†` and `≈` stay — they are salary notation, not icons.

**`npm run check` does NOT cover `web/`.** Verify it with `npx tsc -p web/tsconfig.json --noEmit` and
`npm run web:build`.
