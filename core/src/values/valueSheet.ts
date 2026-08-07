import type { RawPlayer } from "../sleeper/client";

/** A row from a value source (an expert/ADP auction-value list). */
export interface ValueRow {
  name: string;
  position?: string;
  team?: string;
  value: number;
}

export interface MatchResult {
  byId: Map<string, number>; // sleeper player_id -> value
  unmatched: ValueRow[]; // rows we couldn't map to a player
}

const NFL_TEAMS = new Set([
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC",
  "LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS",
]);

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Normalize a player name for matching: lowercase, strip punctuation + generational suffixes. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .join(" ")
    .trim();
}

/** Parse a value CSV. Columns (any order, case-insensitive): name/player, value/$, position/pos, team/nfl. */
export function parseValueCsv(text: string): ValueRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = idx(["name", "player", "player_name", "player name"]);
  const iVal = idx(["value", "$", "auction", "auction_value", "salary", "cost"]);
  const iPos = idx(["position", "pos"]);
  const iTeam = idx(["team", "nfl", "nfl_team", "nflteam"]);
  const rows: ValueRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const c = splitCsvLine(lines[r]!);
    const name = (c[iName] ?? "").trim();
    const value = Number(String(c[iVal] ?? "").replace(/[$,]/g, ""));
    if (!name || !Number.isFinite(value)) continue;
    rows.push({
      name,
      value,
      position: iPos >= 0 ? (c[iPos] ?? "").trim().toUpperCase() : undefined,
      team: iTeam >= 0 ? (c[iTeam] ?? "").trim().toUpperCase() : undefined,
    });
  }
  return rows;
}

/**
 * Match value rows to Sleeper player_ids. Skill players match by normalized name (tiebreak on
 * position, then team); defenses match by NFL team code. Unmatched rows are returned for the user.
 */
export function matchValues(players: Record<string, RawPlayer>, rows: ValueRow[]): MatchResult {
  // name -> candidate ids
  const byName = new Map<string, { id: string; pos: string; team: string }[]>();
  for (const [id, p] of Object.entries(players)) {
    const pos = (p.position ?? "").toUpperCase();
    if (!["QB", "RB", "WR", "TE", "K"].includes(pos)) continue;
    const full = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
    if (!full) continue;
    const key = normalizeName(full);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push({ id, pos, team: (p.team ?? "").toUpperCase() });
  }

  const byId = new Map<string, number>();
  const unmatched: ValueRow[] = [];
  for (const row of rows) {
    // Defense: match to the team-code id Sleeper uses for DEF.
    if (row.position === "DEF" || row.position === "DST") {
      const code = teamCode(row.team) ?? teamCode(row.name);
      if (code) {
        byId.set(code, row.value);
        continue;
      }
    }
    const cands = byName.get(normalizeName(row.name));
    if (!cands || cands.length === 0) {
      unmatched.push(row);
      continue;
    }
    let pick = cands[0]!;
    if (cands.length > 1) {
      const byPos = row.position ? cands.filter((c) => c.pos === row.position) : cands;
      const byTeam = row.team ? byPos.filter((c) => c.team === row.team) : byPos;
      pick = byTeam[0] ?? byPos[0] ?? cands[0]!;
    }
    // don't overwrite a better (earlier/higher) match already set for this id
    if (!byId.has(pick.id)) byId.set(pick.id, row.value);
  }
  return { byId, unmatched };
}

function teamCode(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase().trim();
  if (NFL_TEAMS.has(up)) return up;
  return undefined;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
