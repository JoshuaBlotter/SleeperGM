import type { PlayerLite } from "../types";
import type { RawPlayer } from "./client";
import { sleeper } from "./client";

const DEF_CODES = new Set([
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC",
  "LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS",
]);

/** Turn a raw players map into resolved PlayerLite objects. Pure — testable with a fixture. */
export function toPlayerLite(id: string, raw: RawPlayer | undefined): PlayerLite {
  if (DEF_CODES.has(id) && (!raw || raw.position === "DEF")) {
    const name = raw?.full_name || [raw?.first_name, raw?.last_name].filter(Boolean).join(" ") || `${id} DEF`;
    return { id, name, position: "DEF", team: id };
  }
  if (!raw) return { id, name: id, position: "?", team: null };
  const name =
    raw.full_name || [raw.first_name, raw.last_name].filter(Boolean).join(" ").trim() || id;
  return { id, name, position: raw.position || "?", team: raw.team ?? null };
}

export function buildResolver(players: Record<string, RawPlayer>) {
  return {
    resolve(id: string): PlayerLite {
      return toPlayerLite(id, players[id]);
    },
    resolveMany(ids: string[]): PlayerLite[] {
      return ids.map((id) => toPlayerLite(id, players[id]));
    },
  };
}

/** Live variant: fetches (cached) the ~5MB players DB, then resolves. */
export async function loadResolver() {
  const players = (await sleeper.getPlayers()) ?? {};
  return buildResolver(players);
}
