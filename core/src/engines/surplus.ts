import type { KeeperLine, SurplusLine, ValueLine } from "../types";

/** Combine keeper cost + valuation into surplus lines with a simple recommendation. Pure. */
export function toSurplusLines(
  keeperLines: KeeperLine[],
  values: Map<string, ValueLine>,
): SurplusLine[] {
  return keeperLines
    .map((k): SurplusLine => {
      const worth = values.get(k.playerId)?.value ?? 0;
      const surplus = worth - k.keeperCostNextYear;
      return { ...k, worth, surplus, recommendation: recommendation(surplus, worth) };
    })
    .sort((a, b) => b.surplus - a.surplus);
}

export function recommendation(surplus: number, worth: number): SurplusLine["recommendation"] {
  if (surplus >= 5) return "keep";
  if (surplus <= -5 || worth <= 1) return "cut";
  return "hold";
}
