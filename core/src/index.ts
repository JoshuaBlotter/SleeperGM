// Public API for @sgm/core — consumed by the CLI, tests, and (later) the web server.

export * from "./types";
export * from "./env";

export { sleeper, TTL } from "./sleeper/client";
export type {
  RawLeague,
  RawRoster,
  RawUser,
  RawDraft,
  RawDraftPick,
  RawTransaction,
  RawMatchup,
  RawPlayer,
} from "./sleeper/client";
export { cached, clearCache } from "./sleeper/cache";
export { buildResolver, loadResolver, toPlayerLite } from "./sleeper/players";

export { buildRegistry, findTeam, loadRegistry } from "./registry/teams";

export { buildChain } from "./history/chain";
export { buildDraftIndex, indexPicks } from "./history/prices";
export { buildFaabIndex, indexTransactions } from "./history/waivers";
export { buildProvenance } from "./history/provenance";
export { buildAcquisitionIndex, ownerTenureStart } from "./history/tenure";
export type { AcquisitionIndex } from "./history/tenure";

export { leagueRules, LeagueRulesSchema, outstandingRules, rookieBaseCost, rookieSlotCost } from "./config/league-rules";
export type { LeagueRules } from "./config/league-rules";

export { keeperCostNextYear, accumulatedSalary, baseSalary, yearIncrement } from "./engines/keepers";
export type { KeeperCost } from "./engines/keepers";
export { loadSalarySheet, sheetSalary, parseSalaryCsv, sheetSupersededByReacquire } from "./config/salaries";
export type { SalarySheet } from "./config/salaries";
export { summarizeCap } from "./engines/cap";
export type { CapSummary } from "./engines/cap";
export { sumPoints, seasonPoints } from "./engines/points";
export { valuePlayers } from "./engines/valuation";
export type { ValuationInputs } from "./engines/valuation";
export { toSurplusLines, recommendation } from "./engines/surplus";

// Orchestration (network-touching) — shared by the CLI and the server.
export {
  loadContext,
  pickTeam,
  loadKeeperData,
  withValueSource,
  teamKeeperLines,
  loadValues,
  teamSurplusBoard,
  leagueInflation,
  inflateBoard,
  loadRookieBoard,
  rookieProspects,
  loadAllPlayers,
  loadTrending,
  loadDraftValue,
  loadScarcity,
  loadTiers,
  loadPlayerDetails,
  worthSource,
  worthSources,
  STREAMER_POSITIONS,
} from "./app";
export type { Ctx, KeeperData, AllPlayerRow, TrendingRow, PlayerDetail, SeasonFinish, TierBoard } from "./app";
export { tierize, bandize } from "./engines/tiers";
export type { Tier, TierPlayer } from "./engines/tiers";
export { gradePlayer } from "./engines/playerDetail";
export type { PlayerGrade, Grade, Archetype } from "./engines/playerDetail";
export { seasonWeeklyPoints, weeklyPoints } from "./engines/points";
export type { WeekScore } from "./engines/points";

// Value sources (§13.3): importable/ADP/expert auction values + overrides.
export { parseValueCsv, matchValues, normalizeName } from "./values/valueSheet";
export type { ValueRow, MatchResult } from "./values/valueSheet";
export { adpToAuctionValues } from "./values/adp";
export type { AdpPlayer } from "./values/adp";
export { listValueSources, getActiveSource, valueSourceExists, loadValueMap, loadValueRows, loadOverrides } from "./values/load";
export { computeRookieBoard, rankRookieProspects } from "./engines/rookies";
export type { RookieBoard, RookiePick, BaseSlot, TeamCapital, StandingRow, TradedPick, RookieProspect } from "./engines/rookies";
export { buildDraftValueReport } from "./engines/draftValue";
export type { DraftValueReport, DraftValueRow, AuctionBuy } from "./engines/draftValue";
export { computeScarcity } from "./engines/scarcity";
export type { PositionScarcity, ScarcityPlayer } from "./engines/scarcity";
export { computeInflation } from "./engines/inflation";
export type { InflationPlayer, InflationResult, TeamSurplus, DiscountLine } from "./engines/inflation";
export { computeTrades } from "./engines/trades";
export type { TradePlayer, SwapSuggestion, TradeReport, TeamNeeds } from "./engines/trades";
