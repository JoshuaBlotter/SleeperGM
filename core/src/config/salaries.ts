import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Authoritative salary sheet from the league manager's workbook. It is the source of truth: we take
 * each player's salary AS OF `season` and escalate forward to the upcoming keeper season, using the
 * listed `yearsKept` so the escalation is exact even for players with pre-2022 history.
 *
 * Preferred source: `config/salaries.csv` (exported/derived from the workbook) with columns
 *   season, player_id, player_name, position, nfl_team, manager, status, old_salary, years_kept,
 *   salary_increase, new_salary
 * where `new_salary` is that player's salary for `season`. Falls back to `config/salaries.json`.
 */
export interface SheetEntry {
  salary: number;
  yearsKept?: number;
}
export interface SalarySheet {
  season: number;
  byPlayerId: Record<string, SheetEntry>;
  byName: Record<string, SheetEntry>;
}

let cache: SalarySheet | null | undefined;

export function loadSalarySheet(): SalarySheet | null {
  if (cache !== undefined) return cache;
  cache = readCsv() ?? readJson() ?? null;
  return cache;
}

function readCsv(): SalarySheet | null {
  try {
    return parseSalaryCsv(readFileSync(path.join(process.cwd(), "config", "salaries.csv"), "utf8"));
  } catch {
    return null;
  }
}

/** Parse the salaries CSV into a SalarySheet. Pure — testable without the filesystem. */
export function parseSalaryCsv(text: string): SalarySheet {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iId = col("player_id");
  const iName = col("player_name");
  const iSalary = col("new_salary");
  const iYears = col("years_kept");
  const iSeason = col("season");

  const sheet: SalarySheet = { season: 0, byPlayerId: {}, byName: {} };
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]!);
    const salary = Number(cells[iSalary]);
    if (!Number.isFinite(salary)) continue;
    const entry: SheetEntry = { salary, yearsKept: toNum(cells[iYears]) };
    const id = (cells[iId] ?? "").trim();
    const name = (cells[iName] ?? "").trim();
    if (id) sheet.byPlayerId[id] = entry;
    if (name) sheet.byName[name.toLowerCase()] = entry;
    const s = Number(cells[iSeason]);
    if (Number.isFinite(s) && s > sheet.season) sheet.season = s;
  }
  return sheet;
}

function readJson(): SalarySheet | null {
  try {
    const parsed = JSON.parse(readFileSync(path.join(process.cwd(), "config", "salaries.json"), "utf8")) as {
      season?: number;
      byPlayerId?: Record<string, unknown>;
      byName?: Record<string, unknown>;
    };
    return {
      season: Number(parsed.season) || 0,
      byPlayerId: normalizeEntries(parsed.byPlayerId ?? {}, false),
      byName: normalizeEntries(parsed.byName ?? {}, true),
    };
  } catch {
    return null;
  }
}

export function sheetSalary(sheet: SalarySheet | null, playerId: string, name: string): SheetEntry | undefined {
  if (!sheet) return undefined;
  return sheet.byPlayerId[playerId] ?? sheet.byName[name.trim().toLowerCase()];
}

/**
 * The sheet is a PRE-auction snapshot of its season. If a player was re-acquired via auction/FAAB in
 * that season or later, their cost reset (§6.3) to something the sheet never captured — so the
 * API-computed cost supersedes the sheet. (Trades don't reset, so a traded player still uses the sheet.)
 */
export function sheetSupersededByReacquire(
  sheetSeason: number,
  acquisitionSeason: string | null,
  acquiredVia: string,
): boolean {
  const s = Number(acquisitionSeason);
  if (!Number.isFinite(s)) return false;
  return s >= sheetSeason && (acquiredVia === "auction" || acquiredVia === "faab" || acquiredVia === "free_agent");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function toNum(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeEntries(rec: Record<string, unknown>, lowerKeys: boolean): Record<string, SheetEntry> {
  const out: Record<string, SheetEntry> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith("_")) continue;
    const key = lowerKeys ? k.trim().toLowerCase() : k;
    if (typeof v === "number") out[key] = { salary: v };
    else if (v && typeof v === "object" && "salary" in v) {
      const o = v as { salary: number; yearsKept?: number };
      out[key] = { salary: Number(o.salary), yearsKept: o.yearsKept === undefined ? undefined : Number(o.yearsKept) };
    }
  }
  return out;
}

/** Test seam. */
export function __setSalarySheet(sheet: SalarySheet | null | undefined): void {
  cache = sheet;
}
