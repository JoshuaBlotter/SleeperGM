# Value sources

Player **worth** ($) comes from a selectable source. The active source's values overlay the built-in
VORP model (fallback for anyone the source is missing), and `overrides.csv` always wins.

## Choosing the source
- Default: `adp` if `adp.csv` exists, else `vorp` (built-in).
- Override: set `SGM_VALUE_SOURCE=<name>` (e.g. `adp`, `vorp`, or any file here).
- Inspect: `npm run sgm -- values` (shows active source + match coverage + unmatched players).

## Sources here
- **`adp.csv`** — auto-generated from Fantasy Football Calculator's public ADP, converted to auction $.
  Refresh with `npm run values:adp`. This is the "extrapolate from ADP" source. The rank→dollars curve
  is fitted to ESPN's published auction values (see `core/src/values/adp.ts`), so the two agree on
  shape and disagree only where the two sites rank players differently.
- **`espn.csv`** — auto-generated from ESPN's public fantasy endpoint, which publishes a real auction
  value per player. Refresh with `npm run values:espn`. ESPN prices its own stock league (10 teams ×
  $200), so the values are rescaled to our 12 × $200 pool; players ESPN prices at $0 are left out
  entirely, because a $0 is ESPN saying "not on the draft board".
- **`espn-trends.csv`** — ESPN's public **Live Draft Trends** AVG SALARY: what players are *actually*
  going for in live ESPN auctions right now (vs. `espn.csv`, which is ESPN's published *estimate*).
  There's no clean endpoint, so it's paste-driven — copy the whole trends table into a text file and run
  `npm run values:espn-trends -- <file.txt>`. All the paste noise (repeated names, injury tags, `D/ST`,
  ESPN's `WSH` spelling) is handled by `core/src/values/espnTrends.ts`. The **raw** ESPN salary is kept
  (ESPN already prices a $200 auction; the site's inflation control does any league scaling) — rounded
  to whole dollars; players going for $0 (i.e. undrafted) are left out.
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
