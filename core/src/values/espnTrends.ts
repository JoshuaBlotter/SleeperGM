// ESPN "live draft trends" AVG SALARY -> ValueRows. PURE.
//
// A DIFFERENT ESPN source than `espn.ts`: that one reads ESPN's published auction *estimate* off the
// kona endpoint; this one is the AVG SALARY column of the public "Live Draft Trends" page — what
// players are ACTUALLY going for in live ESPN drafts right now. There's no clean endpoint for it, so
// it arrives as a copy-paste of the rendered table, which is noisy: the player name is repeated (once
// concatenated, once clean), an optional injury tag (Q/O/IR/...) sits between name and team, defenses
// read "Texans D/ST", and team codes use ESPN's spelling (WSH). We parse it structurally.
//
// The table is a flat list of lines. Each player record starts at a bare-integer RANK line (every
// numeric stat below has a decimal or a +/- sign, so only ranks match /^\d+$/), and its tail is always
// the same shape counting from the END:
//
//   ... NAME  [INJURY?]  TEAM  POS  AVG_PICK  d7  AVG_SALARY  d7  %ROST
//
// so TEAM/POS/AVG_SALARY are fixed offsets from the record's end regardless of how many name lines the
// paste produced. AVG_SALARY is the value. Everything before the first rank line (the column headers)
// is skipped for free.
//
// Unlike `espn.ts`, this source is NOT rescaled: ESPN's live auctions already run a $200 budget, the
// same as ours, so the AVG SALARY dollars are used as-is (rounded to whole dollars — money is integer
// here). We keep the RAW market number on purpose; that's the whole point of a "what it actually went
// for" source.

import type { ValueRow } from "./valueSheet";

/** ESPN spells Washington "WSH"; Sleeper uses "WAS". "FA" is a free agent (no team). */
const TEAM_FIXUPS: Record<string, string> = { WSH: "WAS", FA: "" };

/** Short all-caps tokens ESPN drops between the name and the team; not part of the name. */
const INJURY_TAGS = new Set(["Q", "O", "D", "P", "SSPD", "IR", "PUP", "SUS", "DNP", "NA"]);

interface RawEntry {
  name: string;
  position: string;
  team: string | undefined;
  raw: number;
}

/** POS -> our code: "D/ST" is a defense; "WR, CB" and the like keep their first listed slot. */
function normalizePosition(pos: string): string {
  const up = pos.trim().toUpperCase();
  if (up === "D/ST" || up === "DST" || up === "DEF") return "DEF";
  return up.split(/[,/\s]+/)[0] ?? up;
}

function normalizeTeam(team: string): string | undefined {
  const up = team.trim().toUpperCase();
  const fixed = TEAM_FIXUPS[up] ?? up;
  return fixed || undefined;
}

/** Break the flat line list into per-player records, each beginning at its rank line. */
function toRecords(raw: string): string[][] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const records: string[][] = [];
  let cur: string[] | null = null;
  for (const line of lines) {
    if (/^\d+$/.test(line)) {
      if (cur) records.push(cur);
      cur = [line];
    } else if (cur) {
      cur.push(line);
    }
    // lines before the first rank (the column headers) fall through and are dropped
  }
  if (cur) records.push(cur);
  return records;
}

/** Pull name/position/team/salary out of one record by its fixed tail offsets. */
function parseRecord(r: string[]): RawEntry | undefined {
  // rank + name + team + pos + 5 stat lines = 8 minimum; a repeated name or injury tag adds more.
  if (r.length < 8) return undefined;
  const n = r.length;
  const position = normalizePosition(r[n - 6]!);
  const team = normalizeTeam(r[n - 7]!);
  const raw = Number(r[n - 3]);
  if (!Number.isFinite(raw)) return undefined;

  let nameIdx = n - 8;
  if (INJURY_TAGS.has(r[nameIdx]!.toUpperCase())) nameIdx -= 1; // skip the injury tag line
  const name = r[nameIdx]?.trim();
  if (!name) return undefined;

  return { name, position, team, raw };
}

/**
 * Convert a pasted ESPN Live Draft Trends table into value rows, keeping the RAW average salary (ESPN
 * already prices a $200 auction; the site's inflation control does any league scaling). Only players
 * going for more than $0 are kept (a $0 average salary is a player who isn't being drafted, not a $0 to
 * rank), the salary is rounded to whole dollars with a $1 floor so a sub-$0.50 player still lists, and
 * defenses are emitted as `DEF` + team code so the matcher finds them by team.
 */
export function parseEspnTrends(raw: string): ValueRow[] {
  const rows: ValueRow[] = [];
  for (const rec of toRecords(raw)) {
    const entry = parseRecord(rec);
    if (!entry || !(entry.raw > 0)) continue;
    rows.push({
      name: entry.position === "DEF" ? `${entry.team ?? entry.name} Defense` : entry.name,
      position: entry.position,
      team: entry.team,
      value: Math.max(1, Math.round(entry.raw)),
    });
  }
  return rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
