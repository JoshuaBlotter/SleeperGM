import { expect, test } from "vitest";
import { buildResolver, toPlayerLite } from "../sleeper/players";
import type { RawPlayer } from "../sleeper/client";

const db: Record<string, RawPlayer> = {
  "4034": { player_id: "4034", full_name: "Christian McCaffrey", position: "RB", team: "SF" },
  "10236": { first_name: "Dalton", last_name: "Kincaid", position: "TE", team: "BUF" },
  SF: { position: "DEF", first_name: "San Francisco", last_name: "49ers" },
};

test("resolves a normal player by full_name", () => {
  const p = toPlayerLite("4034", db["4034"]);
  expect(p).toEqual({ id: "4034", name: "Christian McCaffrey", position: "RB", team: "SF" });
});

test("builds name from first+last when full_name missing", () => {
  expect(toPlayerLite("10236", db["10236"]).name).toBe("Dalton Kincaid");
});

test("treats team codes as DEF", () => {
  const p = toPlayerLite("SF", db["SF"]);
  expect(p.position).toBe("DEF");
  expect(p.team).toBe("SF");
});

test("unknown id degrades gracefully", () => {
  const p = toPlayerLite("nope", undefined);
  expect(p).toEqual({ id: "nope", name: "nope", position: "?", team: null });
});

test("resolver resolves many", () => {
  const r = buildResolver(db);
  expect(r.resolveMany(["4034", "SF"]).map((p) => p.position)).toEqual(["RB", "DEF"]);
});
