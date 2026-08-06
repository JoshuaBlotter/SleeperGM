import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getCacheDir } from "../env";

interface Entry<T> {
  at: number;
  ttlMs: number;
  data: T;
}

const mem = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Injectable clock so TTL behavior is deterministically testable.
let clock: () => number = () => Date.now();
export function __setClock(fn: () => number): void {
  clock = fn;
}
export function __resetClock(): void {
  clock = () => Date.now();
}

function keyToFile(key: string): string {
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
  const safe = key.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
  return path.join(getCacheDir(), `${safe}.${hash}.json`);
}

/**
 * Return cached data for `key` if fresh (memory, then disk); otherwise run `loader`,
 * store the result with `ttlMs`, and return it.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = clock();

  const m = mem.get(key) as Entry<T> | undefined;
  if (m && now - m.at < m.ttlMs) return m.data;

  // Coalesce concurrent requests for the same key (the FAAB + acquisition indexes fetch overlapping
  // transactions at once). The `inflight` set happens synchronously below, before any await.
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = load(key, ttlMs, loader, now, m);
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

async function load<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  now: number,
  memEntry: Entry<T> | undefined,
): Promise<T> {
  // Read whatever is on disk (fresh OR stale) so we can serve it if the network is down.
  let disk: Entry<T> | undefined;
  try {
    disk = JSON.parse(await fs.readFile(keyToFile(key), "utf8")) as Entry<T>;
  } catch {
    // no disk copy
  }
  if (disk && now - disk.at < disk.ttlMs) {
    mem.set(key, disk);
    return disk.data;
  }

  try {
    const data = await loader();
    const entry: Entry<T> = { at: now, ttlMs, data };
    mem.set(key, entry);
    try {
      await fs.mkdir(getCacheDir(), { recursive: true });
      await fs.writeFile(keyToFile(key), JSON.stringify(entry));
    } catch {
      // best-effort persistence
    }
    return data;
  } catch (err) {
    // Network/load failed. Rather than crash, serve a stale copy if we have one.
    const stale = disk ?? memEntry;
    if (stale) {
      warnStaleOnce();
      mem.set(key, stale);
      return stale.data;
    }
    throw err;
  }
}

let warnedStale = false;
function warnStaleOnce(): void {
  if (warnedStale) return;
  warnedStale = true;
  console.error("⚠  Sleeper API unreachable — showing cached data (may be stale). Run 'sgm refresh' when back online.");
}

/** Wipe memory + on-disk cache. Backs `sgm refresh`. */
export async function clearCache(): Promise<void> {
  mem.clear();
  try {
    await fs.rm(getCacheDir(), { recursive: true, force: true });
  } catch {
    // nothing to clear
  }
}

/** Clear only the in-memory layer (used by tests). */
export function __clearMemory(): void {
  mem.clear();
  inflight.clear();
}
