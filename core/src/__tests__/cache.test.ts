import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { __clearMemory, __resetClock, __setClock, cached, clearCache } from "../sleeper/cache";

beforeAll(() => {
  process.env.SGM_CACHE_DIR = path.join(os.tmpdir(), `sgm-test-${randomUUID()}`);
});
afterEach(() => __clearMemory());
afterAll(async () => {
  await clearCache();
  __resetClock();
});

test("returns cached value within TTL (loader runs once)", async () => {
  let t = 1000;
  __setClock(() => t);
  let calls = 0;
  const load = async () => ++calls;

  expect(await cached("k1", 100, load)).toBe(1); // miss
  expect(await cached("k1", 100, load)).toBe(1); // memory hit
  expect(calls).toBe(1);
});

test("reloads after TTL expiry", async () => {
  let t = 1000;
  __setClock(() => t);
  let calls = 0;
  const load = async () => ++calls;

  expect(await cached("k2", 100, load)).toBe(1);
  __clearMemory(); // force disk path
  t = 2000; // now stale on disk (2000 - 1000 > 100)
  expect(await cached("k2", 100, load)).toBe(2);
  expect(calls).toBe(2);
});

test("disk survives memory clear within TTL", async () => {
  let t = 5000;
  __setClock(() => t);
  let calls = 0;
  const load = async () => ++calls;

  expect(await cached("k3", 10_000, load)).toBe(1);
  __clearMemory();
  t = 6000; // still fresh
  expect(await cached("k3", 10_000, load)).toBe(1); // served from disk, loader not re-run
  expect(calls).toBe(1);
});

test("serves STALE disk copy when the loader (network) fails", async () => {
  let t = 1000;
  __setClock(() => t);
  expect(await cached("k4", 100, async () => "v1")).toBe("v1");
  __clearMemory();
  t = 9000; // disk entry now stale
  const boom = async () => {
    throw new Error("network down");
  };
  expect(await cached("k4", 100, boom)).toBe("v1"); // degraded gracefully, no throw
});

test("throws when the loader fails and there is no cache at all", async () => {
  const boom = async () => {
    throw new Error("network down");
  };
  await expect(cached("k5-never-cached", 100, boom)).rejects.toThrow("network down");
});

test("coalesces concurrent requests for the same key (loader runs once)", async () => {
  __setClock(() => 1000);
  let calls = 0;
  const slow = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return "shared";
  };
  const [a, b, c] = await Promise.all([cached("k6", 100, slow), cached("k6", 100, slow), cached("k6", 100, slow)]);
  expect([a, b, c]).toEqual(["shared", "shared", "shared"]);
  expect(calls).toBe(1); // three concurrent callers, one underlying load
});
