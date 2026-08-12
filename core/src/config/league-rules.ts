import { z } from "zod";

/**
 * House rules for "Los Socios" — the single source of truth. Every rule here is REAL, transcribed
 * from the commissioner's rules doc; `sgm rulebook` renders them.
 *
 * §6.1 escalation and §6.4 rookie cost were once guessed. The `placeholder` flag and
 * `outstandingRules()` stay as the guard: set it back to `true` on any rule that turns out to be a
 * guess, and the rulebook prints an OUTSTANDING banner instead of quietly passing it off as fact.
 */

export const EscalationSchema = z.object({
  model: z.literal("positional"),
  // Skill positions: new = old + positionalBase[pos] + yearsKept (applied every offseason).
  positionalBase: z.record(z.string(), z.number()),
  // K/DEF (and any position not in positionalBase): new = old + flatIncrease each year.
  flatIncrease: z.number().default(1),
  flatPositions: z.array(z.string()).default(["K", "DEF"]),
  floor: z.number().default(1),
  placeholder: z.boolean().default(false),
});

export const RookieCostSchema = z.object({
  model: z.literal("table"),
  // pickSlot (1-12) -> position -> starting salary.
  table: z.record(z.string(), z.record(z.string(), z.number())),
  floor: z.number().default(1),
  placeholder: z.boolean().default(false),
});

export const RookieDraftSchema = z.object({
  // Number of rounds in the rookie draft. Only round 1 has a known salary table (§6.4); default 1 until
  // the real round count is confirmed. Bumping this generates later rounds (costs shown as "—").
  rounds: z.number().int().positive().default(1),
  snake: z.boolean().default(true),
  // How the base pick order is derived (Sleeper doesn't publish the 2026 rookie order).
  orderBasis: z.literal("reverseRegularSeason").default("reverseRegularSeason"),
  roundsAssumed: z.boolean().default(true), // surfaced by the rulebook until confirmed
});

export const LeagueRulesSchema = z.object({
  capBudget: z.number().int().positive(),
  maxKeepers: z.number().int().positive(),
  keeperEscalation: EscalationSchema,
  waiverKeeperCost: z.object({ source: z.literal("faabBid") }),
  resetCostOnReacquire: z.boolean(),
  rookieCost: RookieCostSchema,
  rookieDraft: RookieDraftSchema,
  taxiCountsAgainstCap: z.boolean(),
  irCountsAgainstCap: z.boolean(),
});

export type LeagueRules = z.infer<typeof LeagueRulesSchema>;

export const leagueRules: LeagueRules = LeagueRulesSchema.parse({
  capBudget: 200, // ✅ auction budget = salary cap (from API)
  maxKeepers: 20, // ✅ from API (effectively unlimited)

  // §6.1 ✅ Escalation: skill positions add positionalBase + yearsKept every offseason;
  // K/DEF add a flat $1/yr. (new salary = old salary + increase.)
  keeperEscalation: {
    model: "positional",
    positionalBase: { QB: 1, RB: 6, WR: 6, TE: 3 },
    flatIncrease: 1,
    flatPositions: ["K", "DEF"],
    floor: 1,
    placeholder: false,
  },

  // §6.2 ✅ waiver-acquired players cost their FAAB bid.
  waiverKeeperCost: { source: "faabBid" },

  // §6.3 ✅ cut & re-acquire resets cost (handled in provenance).
  resetCostOnReacquire: true,

  // §6.4 ✅ Rookie starting salary by draft slot (1-12) x position.
  rookieCost: {
    model: "table",
    table: {
      "1": { QB: 2, RB: 12, WR: 8, TE: 6 },
      "2": { QB: 2, RB: 8, WR: 6, TE: 4 },
      "3": { QB: 1, RB: 6, WR: 5, TE: 3 },
      "4": { QB: 1, RB: 4, WR: 4, TE: 2 },
      "5": { QB: 1, RB: 3, WR: 4, TE: 2 },
      "6": { QB: 1, RB: 2, WR: 3, TE: 1 },
      "7": { QB: 1, RB: 2, WR: 3, TE: 1 },
      "8": { QB: 1, RB: 2, WR: 2, TE: 1 },
      "9": { QB: 1, RB: 1, WR: 2, TE: 1 },
      "10": { QB: 1, RB: 1, WR: 1, TE: 1 },
      "11": { QB: 1, RB: 1, WR: 1, TE: 1 },
      "12": { QB: 1, RB: 1, WR: 1, TE: 1 },
    },
    floor: 1,
    placeholder: false,
  },

  // Rookie draft: snake order derived from reverse 2025 regular-season standings (Sleeper doesn't
  // publish the 2026 order). Confirmed by the commissioner: 1 round (matches the §6.4 cost table).
  rookieDraft: {
    rounds: 1,
    snake: true,
    orderBasis: "reverseRegularSeason",
    roundsAssumed: false,
  },

  // §6.5 ✅ taxi + IR count against cap; priced like everyone else (no special case).
  taxiCountsAgainstCap: true,
  irCountsAgainstCap: true,
});

/** Rookie starting salary from the (draft slot x position) table. */
export function rookieBaseCost(slot: number, position: string, rules: LeagueRules = leagueRules): number {
  const row = rules.rookieCost.table[String(slot)];
  const v = row?.[position];
  return v ?? rules.rookieCost.floor;
}

/**
 * The full position→salary map for a rookie pick. Only round 1 has a known table (§6.4); other rounds
 * return an empty map (cost unknown → shown as "—"). Used by the rookie draft board.
 */
export function rookieSlotCost(slot: number, round: number, rules: LeagueRules = leagueRules): Record<string, number> {
  if (round !== 1) return {};
  const row = rules.rookieCost.table[String(slot)];
  return row ? { ...row } : {};
}

/** Human-readable flags for anything still faked, surfaced by `sgm rulebook`. */
export function outstandingRules(rules: LeagueRules = leagueRules): string[] {
  const out: string[] = [];
  if (rules.keeperEscalation.placeholder) out.push(`§6.1 Keeper escalation still a placeholder.`);
  if (rules.rookieCost.placeholder) out.push(`§6.4 Rookie cost table still a placeholder.`);
  return out;
}
