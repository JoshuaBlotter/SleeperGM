import { readFileSync } from "node:fs";
import path from "node:path";

let loaded = false;

/** Minimal .env loader (no dependency). Values already in process.env win. */
function loadDotEnv(): void {
  if (loaded) return;
  loaded = true;
  try {
    const txt = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!.trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // no .env file — fine
  }
}

export const DEFAULT_LEAGUE_ID = "1389689313502961664";

export function getLeagueId(): string {
  loadDotEnv();
  return (process.env.LEAGUE_ID || "").trim() || DEFAULT_LEAGUE_ID;
}

export function getCacheDir(): string {
  loadDotEnv();
  return (process.env.SGM_CACHE_DIR || "").trim() || path.join(process.cwd(), ".cache");
}
