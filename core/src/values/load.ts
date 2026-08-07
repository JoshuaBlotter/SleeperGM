import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { RawPlayer } from "../sleeper/client";
import { matchValues, parseValueCsv, type MatchResult, type ValueRow } from "./valueSheet";

const dir = () => path.join(process.cwd(), "config", "values");

/**
 * Source names available in config/values/ (excluding overrides). A CSV with only a header (or only
 * comments) is treated as an unfilled import template and hidden until it has at least one data row,
 * so empty slots like `fantasypros.csv` don't clutter the dropdown until you paste values in.
 */
export function listValueSources(): string[] {
  try {
    return readdirSync(dir())
      .filter((f) => f.endsWith(".csv") && f !== "overrides.csv")
      .map((f) => f.replace(/\.csv$/, ""))
      .filter((name) => loadValueRows(name).length > 0)
      .sort();
  } catch {
    return [];
  }
}

export function valueSourceExists(name: string): boolean {
  try {
    return existsSync(path.join(dir(), `${name}.csv`));
  } catch {
    return false;
  }
}

/** Active value source: env override, else "adp" if present, else the built-in "vorp" model. */
export function getActiveSource(): string {
  const env = (process.env.SGM_VALUE_SOURCE || "").trim();
  if (env) return env;
  return valueSourceExists("adp") ? "adp" : "vorp";
}

export function loadValueRows(name: string): ValueRow[] {
  try {
    return parseValueCsv(readFileSync(path.join(dir(), `${name}.csv`), "utf8"));
  } catch {
    return [];
  }
}

export function loadValueMap(name: string, players: Record<string, RawPlayer>): MatchResult {
  return matchValues(players, loadValueRows(name));
}

/** Manual per-player overrides (config/values/overrides.csv) — always win. */
export function loadOverrides(players: Record<string, RawPlayer>): Map<string, number> {
  try {
    const rows = parseValueCsv(readFileSync(path.join(dir(), "overrides.csv"), "utf8"));
    return matchValues(players, rows).byId;
  } catch {
    return new Map();
  }
}
