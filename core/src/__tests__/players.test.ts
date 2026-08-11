import { expect, test } from "vitest";
import { buildResolver, toPlayerLite } from "../sleeper/players";
import type { RawPlayer } from "../sleeper/client";

const db: Record<string, RawPlayer> = {
  "4034": { player_id: "4034", full_name: "Christian McCaffrey", position: "RB", team: "SF", years_exp: 8 },
  "10236": { first_name: "Dalton", last_name: "Kincaid", position: "TE", team: "BUF" },
  "99999": { full_name: "Rookie Guy", position: "WR", team: "LAR", years_exp: 0 },
  SF: { position: "DEF", first_name: "San Francisco", last_name: "49ers", years_exp: 0 },
};

test("resolves a normal player by full_name", () => {
  const p = toPlayerLite("4034", db["4034"]);
  expect(p).toEqual({ id: "4034", name: "Christian McCaffrey", position: "RB", team: "SF", nflExperience: 8 });
});

// Issue #11: NFL experience and seasons-in-our-league are different numbers and must not be conflated.
test("carries NFL experience through from years_exp", () => {
  expect(toPlayerLite("4034", db["4034"]).nflExperience).toBe(8);
});

test("an incoming rookie is 0 experience, not unknown", () => {
  expect(toPlayerLite("99999", db["99999"]).nflExperience).toBe(0);
});

test("missing years_exp is null, so it never reads as a rookie", () => {
  expect(toPlayerLite("10236", db["10236"]).nflExperience).toBeNull();
});

test("a defense has no NFL experience — null, not the 0 Sleeper reports", () => {
  expect(toPlayerLite("SF", db["SF"]).nflExperience).toBeNull();
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
  expect(p).toEqual({ id: "nope", name: "nope", position: "?", team: null, nflExperience: null });
});

test("resolver resolves many", () => {
  const r = buildResolver(db);
  expect(r.resolveMany(["4034", "SF"]).map((p) => p.position)).toEqual(["RB", "DEF"]);
});
