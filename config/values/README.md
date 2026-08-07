# Value sources

Player **worth** ($) comes from a selectable source. The active source's values overlay the built-in
VORP model (fallback for anyone the source is missing), and `overrides.csv` always wins.

## Choosing the source
- Default: `adp` if `adp.csv` exists, else `vorp` (built-in).
- Override: set `SGM_VALUE_SOURCE=<name>` (e.g. `adp`, `vorp`, or any file here).
- Inspect: `npm run sgm -- values` (shows active source + match coverage + unmatched players).

## Sources here
- **`adp.csv`** — auto-generated from Fantasy Football Calculator's public ADP, converted to auction $.
  Refresh with `npm run values:adp`. This is the "extrapolate from ADP" source.
- **`fantasypros.csv`, `cbs.csv`, `draftsharks.csv`, `footballguys.csv`** — pre-made **import slots** for
  the expert sites. These sites gate their values behind JS/login, so we can't scrape them reliably —
  instead, paste the site's own auction values into the matching file. Each slot stays **hidden** from
  the app's `values` dropdown until it has at least one data row (a header-only file counts as empty).
- **`overrides.csv`** — your manual per-player fixes (highest priority; wins over any source).

## Filling an import slot (FantasyPros / CBS / DraftSharks / Footballguys)
1. On the site, set your league (12 teams, $200, PPR) and copy the player + auction-value columns.
2. Open `config/values/<name>.csv` and paste rows under the header as `name,position,team,value`
   (position & team optional but help matching). Flexible headers: `player`, `$`, `pos`, `nfl` also work.
3. Re-run `npm run web:static` (or the nightly Action) to bake it. It then appears in the dropdown.
4. Check coverage any time with `SGM_VALUE_SOURCE=<name> npm run sgm -- values`.

## Notes
- Names are matched to Sleeper ids (punctuation + Jr./III stripped; defenses match by team code).
  Unmatched rows are reported by `sgm values` so you can fix a spelling.
- The static web build bakes in whichever source was active at snapshot time.
