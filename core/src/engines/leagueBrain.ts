// League Brain (v3) — the "GM scouting report" engine. PURE.
//
// Takes fully-digested per-team numbers (no network, no resolver) and produces a profile per team
// (contender index + archetype + tendency tags + a one-line scouting take) plus league-wide superlatives
// ("awards"). All league-relative math (means, ranks, min-max normalization) lives here so it's trivially
// unit-testable. Humor is deterministic (template per dominant signal) — no RNG.

export interface TeamBrainInput {
  rosterId: number;
  teamName: string;
  manager: string;
  lastSeasonWins: number; // prior completed season (0 if unknown)
  rosterValue: number; // Σ worth of skill players
  keeperSurplus: number; // Σ positive surplus (cheap-stud value)
  posCounts: Record<string, number>; // rostered skill players by position (QB/RB/WR/TE)
  spendByPos: Record<string, number>; // auction $ spent by position, pooled across seasons
  tradeCount: number; // completed trades across the chain
  rookiePicks: number; // upcoming rookie picks owned
  avgYearsExp: number | null; // mean years_exp of rostered skill players (youth = rebuild)
  volatility: number | null; // 0..1 share of rostered skill players with a boom-bust profile (null if none graded)
  agingRbCount: number; // rostered RBs at/over the age-cliff experience threshold
  regret: number; // Σ overpay $ on last season's auction buys (paid − actual production value; ≥ 0)
  biggestBust: { name: string; paid: number; worth: number } | null; // the single worst last-season buy
}

export type Archetype = "contender" | "win-now" | "balanced" | "retooling" | "rebuilding";

export interface TeamProfile extends TeamBrainInput {
  spendShare: Record<string, number>; // spendByPos normalized to 0..1 within the team (blank if no spend)
  contenderIndex: number; // 0..100, league-relative
  archetype: Archetype;
  tags: string[]; // e.g. ["RB hoarder", "pays up at QB", "waits on TE"]
  scouting: string; // one witty line built from the strongest signal
}

export interface Superlative {
  id: string;
  emoji: string;
  title: string;
  rosterId: number;
  teamName: string;
  manager: string;
  stat: string; // the number behind it, e.g. "7 RBs" or "38% of $ on QB"
  blurb: string; // one slightly-funny sentence
}

export interface LeagueBrain {
  profiles: TeamProfile[]; // sorted by contenderIndex desc
  superlatives: Superlative[];
  generatedNote: string;
}

const SKILL = ["QB", "RB", "WR", "TE"] as const;
type Pos = (typeof SKILL)[number];

/** Min-max normalize a value to 0..1 across the league; degenerate (all equal) → 0.5. */
function norm(v: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return (v - min) / (max - min);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

function stdev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

const pct = (share: number): string => `${Math.round(share * 100)}%`;

export function computeLeagueBrain(teams: TeamBrainInput[], opts: { spendSeasons: number }): LeagueBrain {
  if (!teams.length) return { profiles: [], superlatives: [], generatedNote: "no teams" };

  // League ranges for normalization.
  const values = teams.map((t) => t.rosterValue);
  const surpluses = teams.map((t) => t.keeperSurplus);
  const wins = teams.map((t) => t.lastSeasonWins);
  const ages = teams.map((t) => t.avgYearsExp ?? 0);
  const [vMin, vMax] = [Math.min(...values), Math.max(...values)];
  const [sMin, sMax] = [Math.min(...surpluses), Math.max(...surpluses)];
  const [wMin, wMax] = [Math.min(...wins), Math.max(...wins)];
  const [aMin, aMax] = [Math.min(...ages), Math.max(...ages)];

  // League means for tendency thresholds.
  const posMean: Record<string, number> = {};
  const posSd: Record<string, number> = {};
  const spendShareMean: Record<string, number> = {};
  for (const pos of SKILL) {
    const counts = teams.map((t) => t.posCounts[pos] ?? 0);
    posMean[pos] = mean(counts);
    posSd[pos] = stdev(counts, posMean[pos]);
  }
  const rookieMean = mean(teams.map((t) => t.rookiePicks));

  // Per-team spend shares (normalized within the team's own auction spend).
  const shareOf = (t: TeamBrainInput): Record<string, number> => {
    const total = SKILL.reduce((s, p) => s + (t.spendByPos[p] ?? 0), 0);
    const out: Record<string, number> = {};
    if (total <= 0) return out; // no spend seen → blank (don't fabricate a tendency)
    for (const pos of SKILL) out[pos] = (t.spendByPos[pos] ?? 0) / total;
    return out;
  };
  const shares = new Map<number, Record<string, number>>();
  for (const t of teams) shares.set(t.rosterId, shareOf(t));
  for (const pos of SKILL) {
    const xs = teams.map((t) => shares.get(t.rosterId)![pos]).filter((x): x is number => x !== undefined);
    spendShareMean[pos] = mean(xs);
  }

  // Contender index: ready-to-win-now blend (rich + cheap + recently winning + a small veteran nudge —
  // an older roster reads as "win now" urgency rather than a rebuild).
  const indexOf = (t: TeamBrainInput): number => {
    const v = norm(t.rosterValue, vMin, vMax);
    const s = norm(t.keeperSurplus, sMin, sMax);
    const w = norm(t.lastSeasonWins, wMin, wMax);
    const oldNudge = norm(t.avgYearsExp ?? 0, aMin, aMax); // older = higher years_exp → win-now nudge
    return Math.round(100 * (0.3 * v + 0.3 * s + 0.25 * w + 0.15 * oldNudge));
  };

  const withIndex = teams.map((t) => ({ t, index: indexOf(t), share: shares.get(t.rosterId)! }));
  const indices = withIndex.map((x) => x.index).sort((a, b) => a - b);
  const third = (arr: number[], frac: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * frac))]!;
  const topCut = third(indices, 2 / 3); // >= this = top third
  const botCut = third(indices, 1 / 3); // <= this = bottom third
  const rookieMedian = [...teams.map((t) => t.rookiePicks)].sort((a, b) => a - b)[Math.floor(teams.length / 2)] ?? 0;

  // Trade/keeper/behavioral leaderboards for tag thresholds.
  const tradeRank = [...teams].sort((a, b) => b.tradeCount - a.tradeCount).map((t) => t.rosterId);
  const surplusRank = [...teams].sort((a, b) => b.keeperSurplus - a.keeperSurplus).map((t) => t.rosterId);
  const regretRank = [...teams].sort((a, b) => b.regret - a.regret).map((t) => t.rosterId);
  const volatilityRank = [...teams]
    .filter((t) => t.volatility !== null)
    .sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0))
    .map((t) => t.rosterId);

  const profiles: TeamProfile[] = withIndex.map(({ t, index, share }) => {
    const archetype = classify(t, index, { topCut, botCut, aMin, aMax, rookieMedian });
    const tags = tagsFor(t, share, { posMean, posSd, spendShareMean, tradeRank, surplusRank, rookieMean, regretRank, volatilityRank });
    return { ...t, spendShare: share, contenderIndex: index, archetype, tags, scouting: scoutingLine(t, share, tags, archetype) };
  });
  profiles.sort((a, b) => b.contenderIndex - a.contenderIndex);

  const superlatives = buildSuperlatives(profiles);
  const note =
    opts.spendSeasons > 0
      ? `spend tendencies pooled over ${opts.spendSeasons} auction season${opts.spendSeasons === 1 ? "" : "s"}`
      : "no auction spend data available";

  return { profiles, superlatives, generatedNote: note };
}

function classify(
  t: TeamBrainInput,
  index: number,
  ctx: { topCut: number; botCut: number; aMin: number; aMax: number; rookieMedian: number },
): Archetype {
  const old = norm(t.avgYearsExp ?? 0, ctx.aMin, ctx.aMax) >= 0.6;
  const young = norm(t.avgYearsExp ?? 0, ctx.aMin, ctx.aMax) <= 0.4;
  const stocked = t.rookiePicks > ctx.rookieMedian;
  const soldPicks = t.rookiePicks < ctx.rookieMedian;

  if (index >= ctx.topCut) return old || soldPicks ? "win-now" : "contender";
  if (index <= ctx.botCut) return young || stocked ? "rebuilding" : "retooling";
  return "balanced";
}

function tagsFor(
  t: TeamBrainInput,
  share: Record<string, number>,
  ctx: {
    posMean: Record<string, number>;
    posSd: Record<string, number>;
    spendShareMean: Record<string, number>;
    tradeRank: number[];
    surplusRank: number[];
    rookieMean: number;
    regretRank: number[];
    volatilityRank: number[];
  },
): string[] {
  const tags: string[] = [];
  const label: Record<Pos, string> = { QB: "QB", RB: "RB", WR: "WR", TE: "TE" };

  // Hoarding: well above the league mean at a position (and a sensible floor).
  for (const pos of SKILL) {
    const n = t.posCounts[pos] ?? 0;
    const floor = pos === "QB" || pos === "TE" ? 3 : 5;
    if (n >= floor && n >= ctx.posMean[pos]! + Math.max(1.5, ctx.posSd[pos]!)) tags.push(`${label[pos]} hoarder`);
  }

  // Spend tendencies (only when we actually saw this team spend at auction).
  if (Object.keys(share).length) {
    for (const pos of SKILL) {
      const sh = share[pos] ?? 0;
      const m = ctx.spendShareMean[pos] ?? 0;
      if (sh >= m + 0.06 && sh >= 0.18) tags.push(`pays up at ${label[pos]}`);
      else if (m > 0.05 && sh <= m * 0.5) tags.push(`waits on ${label[pos]}`);
    }
  }

  if (ctx.tradeRank.slice(0, 2).includes(t.rosterId) && t.tradeCount > 0) tags.push("wheeler-dealer");
  if (ctx.surplusRank.slice(0, 3).includes(t.rosterId) && t.keeperSurplus > 0) tags.push("keeper hoard");
  if (t.rookiePicks >= ctx.rookieMean + 1) tags.push("draft-capital baron");

  // Behavioral / roster-shape signals (v3.1).
  if (t.agingRbCount >= 2) tags.push("aging RB corps");
  if (t.volatility !== null) {
    if (ctx.volatilityRank.slice(0, 2).includes(t.rosterId) && t.volatility >= 0.4) tags.push("boom-or-bust roster");
    else if (t.volatility <= 0.15) tags.push("steady floor");
  }
  if (ctx.regretRank.slice(0, 2).includes(t.rosterId) && t.regret >= 15) tags.push("last year's overpayer");

  return tags;
}

/** Deterministic one-liner keyed off the strongest tag (fallback: archetype). Slight humor. */
function scoutingLine(t: TeamBrainInput, share: Record<string, number>, tags: string[], archetype: Archetype): string {
  const rb = t.posCounts.RB ?? 0;
  const wr = t.posCounts.WR ?? 0;
  const qb = t.posCounts.QB ?? 0;
  const te = t.posCounts.TE ?? 0;
  const primary = tags[0];
  switch (primary) {
    case "RB hoarder":
      return `Rosters ${rb} running backs — the RB position called, it wants some back.`;
    case "WR hoarder":
      return `Hoards ${wr} wideouts. Somebody has to catch all those passes, apparently all of them.`;
    case "QB hoarder":
      return `Keeps ${qb} quarterbacks. You can only start one, but why take chances.`;
    case "TE hoarder":
      return `Owns ${te} tight ends, which is roughly ${te} more useful tight ends than the league average.`;
    case "pays up at QB":
      return `Sinks ${pct(share.QB ?? 0)} of auction cash into QBs — quarterback prices for quarterback feelings.`;
    case "pays up at RB":
      return `Spends ${pct(share.RB ?? 0)} of the budget on running backs. Zero-RB truthers hate this team.`;
    case "pays up at WR":
      return `Pours ${pct(share.WR ?? 0)} of auction money into receivers and dares you to keep up.`;
    case "pays up at TE":
      return `Actually pays retail for tight ends (${pct(share.TE ?? 0)} of spend). Bold. Possibly reckless.`;
    case "waits on TE":
      return `Would rather stream a tight end off the street than pay retail for one.`;
    case "waits on QB":
      return `Waits on quarterback and lets everyone else overpay. Patient, or just cheap.`;
    case "wheeler-dealer":
      return `Has made ${t.tradeCount} trades — never met a roster they didn't want to rearrange.`;
    case "keeper hoard":
      return `Sitting on cheap studs (${Math.round(t.keeperSurplus)} in keeper surplus). The rich get richer.`;
    case "draft-capital baron":
      return `Stockpiling ${t.rookiePicks} rookie picks — clearly playing a longer game than the rest of us.`;
    case "aging RB corps":
      return `Running back room is ${t.agingRbCount}-deep in veterans — hope that cliff is more of a gentle slope.`;
    case "boom-or-bust roster":
      return `Rosters ceilings, not floors — ${pct(t.volatility ?? 0)} of the squad is a weekly coin flip.`;
    case "steady floor":
      return `Nothing flashy, nothing scary — just a lineup that quietly posts its number every week.`;
    case "last year's overpayer":
      return t.biggestBust
        ? `Still paying off last year's auction — ${t.biggestBust.name} cost $${t.biggestBust.paid}, earned like $${t.biggestBust.worth}.`
        : `Last year's auction receipts have not aged well.`;
    default:
      break;
  }
  switch (archetype) {
    case "contender":
      return `Loaded and cheap. The rest of the league should be nervous.`;
    case "win-now":
      return `All-in on the present — a veteran roster spending the future on right now.`;
    case "rebuilding":
      return `Firmly planted in the future; this roster is a group project due next year.`;
    case "retooling":
      return `Stuck in the mushy middle — not bad enough to tank, not good enough to scare anyone.`;
    default:
      return `A balanced roster with no glaring tells. Suspiciously reasonable.`;
  }
}

function buildSuperlatives(profiles: TeamProfile[]): Superlative[] {
  const out: Superlative[] = [];
  const push = (
    id: string,
    emoji: string,
    title: string,
    p: TeamProfile | undefined,
    stat: string,
    blurb: string,
  ) => {
    if (p) out.push({ id, emoji, title, rosterId: p.rosterId, teamName: p.teamName, manager: p.manager, stat, blurb });
  };
  const argmax = (key: (p: TeamProfile) => number, guard = (p: TeamProfile) => true): TeamProfile | undefined => {
    const pool = profiles.filter(guard);
    if (!pool.length) return undefined;
    return pool.reduce((best, p) => (key(p) > key(best) ? p : best));
  };
  const argmin = (key: (p: TeamProfile) => number, guard = (p: TeamProfile) => true): TeamProfile | undefined => {
    const pool = profiles.filter(guard);
    if (!pool.length) return undefined;
    return pool.reduce((best, p) => (key(p) < key(best) ? p : best));
  };

  const rbKing = argmax((p) => p.posCounts.RB ?? 0);
  push("rb-hoarder", "🏈", "The RB Hoarder", rbKing, `${rbKing?.posCounts.RB ?? 0} RBs`, `Corners the running-back market like it's about to be discontinued.`);

  const qbSpend = argmax((p) => p.spendShare.QB ?? 0, (p) => Object.keys(p.spendShare).length > 0);
  push("qb-spender", "💸", "Pays Full Price at QB", qbSpend, `${pct(qbSpend?.spendShare.QB ?? 0)} of $ on QB`, `Drafts quarterbacks early and often — the auction's most reliable QB customer.`);

  const teWaiter = argmin((p) => p.spendShare.TE ?? 1, (p) => Object.keys(p.spendShare).length > 0);
  push("te-streamer", "😴", "Waits on TE", teWaiter, `${pct(teWaiter?.spendShare.TE ?? 0)} of $ on TE`, `Treats tight end as an afterthought and a waiver-wire lottery ticket.`);

  const baron = argmax((p) => p.rookiePicks);
  push("capital-baron", "🎟️", "Draft-Capital Baron", baron, `${baron?.rookiePicks ?? 0} rookie picks`, `Hoards draft capital like it pays dividends.`);

  const keeperKing = argmax((p) => p.keeperSurplus);
  push("best-keepers", "💎", "Best Keepers", keeperKing, `$${Math.round(keeperKing?.keeperSurplus ?? 0)} surplus`, `Getting the biggest discount on the best players — the league's smartest keeps.`);

  const dealer = argmax((p) => p.tradeCount, (p) => p.tradeCount > 0);
  push("wheeler-dealer", "🔁", "Wheeler & Dealer", dealer, `${dealer?.tradeCount ?? 0} trades`, `Never met a roster they didn't want to renovate.`);

  const richest = argmax((p) => p.rosterValue);
  push("richest-roster", "👑", "Most Valuable Roster", richest, `$${Math.round(richest?.rosterValue ?? 0)} of talent`, `The most raw value on paper — now they just have to win with it.`);

  const volatile = argmax((p) => p.volatility ?? 0, (p) => p.volatility !== null && (p.volatility ?? 0) > 0);
  push("boom-bust", "🎢", "Boom-or-Bust Roster", volatile, `${pct(volatile?.volatility ?? 0)} coin-flips`, `Highest ceiling in the league, and the ulcers to match.`);

  const geriatric = argmax((p) => p.agingRbCount, (p) => p.agingRbCount >= 2);
  push("aging-rbs", "👴", "Geriatric Backfield", geriatric, `${geriatric?.agingRbCount ?? 0} veteran RBs`, `The running backs are experienced. Very experienced. Load-management experienced.`);

  const remorse = argmax((p) => p.regret, (p) => p.regret >= 15);
  push(
    "buyers-remorse",
    "🪦",
    "Buyer's Remorse",
    remorse,
    remorse?.biggestBust ? `$${remorse.biggestBust.paid} → $${remorse.biggestBust.worth} on ${remorse.biggestBust.name}` : `$${Math.round(remorse?.regret ?? 0)} overpaid`,
    `Last year's auction sprees are still echoing. The receipts do not spark joy.`,
  );

  const contender = profiles[0]; // sorted by index desc
  push("contender", "🏆", "Prime Contender", contender, `${contender?.contenderIndex ?? 0}/100 index`, `Best-positioned to win it all this season. No pressure.`);

  const rebuild = argmin((p) => p.contenderIndex);
  if (rebuild && rebuild.rosterId !== contender?.rosterId)
    push("rebuild", "🔧", "Deepest Rebuild", rebuild, `${rebuild.contenderIndex}/100 index`, `Playing the long game — very long, by the looks of it.`);

  return out;
}
