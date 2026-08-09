import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Request, type Response } from "express";
import {
  clearCache,
  computeTrades,
  findTeam,
  getLeagueId,
  inflateBoard,
  leagueInflation,
  leagueRules,
  leagueStarterSlots,
  loadAllPlayers,
  loadDraftValue,
  loadScarcity,
  loadTargetPool,
  loadTiers,
  loadPlayerDetails,
  loadContext,
  loadKeeperData,
  loadRookieBoard,
  loadTrending,
  outstandingRules,
  STREAMER_POSITIONS,
  teamSurplusBoard,
  withValueSource,
  worthSource,
  worthSources,
  type Ctx,
  type KeeperData,
  type Team,
  type TradePlayer,
} from "@sgm/core";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// Assemble the (network-cached) context + keeper data once, memoized briefly so a page that hits
// several endpoints doesn't rebuild the league indexes each time. Keeper data for non-default value
// sources is derived lazily (values re-overlaid on the same league indexes) and cached per source.
let state: { at: number; ctx: Ctx; data: KeeperData; source: string; bySource: Map<string, KeeperData> } | null = null;
const STATE_TTL = 5 * 60 * 1000;
async function getState() {
  const now = Date.now();
  if (state && now - state.at < STATE_TTL) return state;
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const source = worthSource();
  state = { at: now, ctx, data, source, bySource: new Map([[source, data]]) };
  return state;
}

/** Keeper data for a requested value source (falls back to the default when unknown/absent). */
async function dataForSource(req: Request): Promise<{ ctx: Ctx; data: KeeperData; source: string }> {
  const s = await getState();
  const requested = String(req.query.source ?? "").trim();
  const source = requested && worthSources().includes(requested) ? requested : s.source;
  if (!s.bySource.has(source)) s.bySource.set(source, await withValueSource(s.ctx, s.data, source));
  return { ctx: s.ctx, data: s.bySource.get(source)!, source };
}

function api(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  };
}

function findRoster(ctx: Ctx, param: string): Team {
  const t = ctx.registry.find((r) => r.rosterId === Number(param)) ?? findTeam(ctx.registry, param);
  if (!t) throw new Error(`team "${param}" not found`);
  return t;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get(
  "/api/league",
  api(async (req) => {
    const { ctx, data, source } = await dataForSource(req);
    const infl = leagueInflation(ctx, data);
    return {
      season: ctx.season,
      capBudget: leagueRules.capBudget,
      multiplier: infl.multiplier,
      valueSource: source,
      sources: worthSources(),
      starterSlots: leagueStarterSlots(ctx),
      updatedAt: new Date(state?.at ?? Date.now()).toISOString(),
      teams: ctx.registry.map((t) => ({
        rosterId: t.rosterId,
        teamName: t.teamName,
        manager: t.displayName,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        players: t.players.length,
        taxi: t.taxi.length,
      })),
    };
  }),
);

app.get(
  "/api/team/:rosterId",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    const team = findRoster(ctx, req.params.rosterId!);
    const inflated = req.query.inflated === "1" || req.query.inflated === "true";
    const multiplier = inflated ? leagueInflation(ctx, data).multiplier : 1;
    let board = teamSurplusBoard(ctx, data, team);
    if (inflated) board = inflateBoard(board, multiplier);
    const used = board.reduce((s, l) => s + l.keeperCostNextYear, 0);
    return {
      rosterId: team.rosterId,
      teamName: team.teamName,
      manager: team.displayName,
      record: { wins: team.wins, losses: team.losses, ties: team.ties },
      inflated,
      multiplier,
      cap: { budget: leagueRules.capBudget, used, available: leagueRules.capBudget - used },
      lines: board,
    };
  }),
);

app.get(
  "/api/players",
  api(async () => {
    // All fantasy-relevant players (rostered + free agents) — source-independent.
    const { ctx, data } = await getState();
    return { players: await loadAllPlayers(ctx, data) };
  }),
);

app.get(
  "/api/trending",
  api(async () => {
    const { ctx, data } = await getState();
    return { trending: await loadTrending(ctx, data) };
  }),
);

app.get(
  "/api/player-details",
  api(async () => {
    const { ctx, data } = await getState();
    return { details: await loadPlayerDetails(ctx, data) };
  }),
);

app.get(
  "/api/inflation",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    return leagueInflation(ctx, data);
  }),
);

app.get(
  "/api/draft-value",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    return loadDraftValue(ctx, data);
  }),
);

app.get(
  "/api/scarcity",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    return { positions: loadScarcity(ctx, data) };
  }),
);

app.get(
  "/api/tiers",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    return loadTiers(ctx, data);
  }),
);

app.get(
  "/api/target-pool",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    return { pool: loadTargetPool(ctx, data) };
  }),
);

app.get(
  "/api/trades/:rosterId",
  api(async (req) => {
    const { ctx, data } = await dataForSource(req);
    const me = findRoster(ctx, req.params.rosterId!);
    const partner = req.query.partner ? findTeam(ctx.registry, String(req.query.partner)) : undefined;
    const all: TradePlayer[] = [];
    for (const t of ctx.registry) {
      for (const l of teamSurplusBoard(ctx, data, t)) {
        if (STREAMER_POSITIONS.has(l.position)) continue;
        all.push({ playerId: l.playerId, name: l.name, position: l.position, teamId: t.rosterId, teamName: t.teamName, worth: l.worth, salary: l.keeperCostNextYear, surplus: l.surplus });
      }
    }
    return computeTrades(all, me.rosterId, { partnerTeamId: partner?.rosterId, rosterPositions: ctx.rosterPositions });
  }),
);

app.get(
  "/api/rules",
  api(async () => ({ rules: leagueRules, outstanding: outstandingRules() })),
);

app.get(
  "/api/rookies",
  api(async () => {
    const { ctx } = await getState();
    return loadRookieBoard(ctx);
  }),
);

app.post(
  "/api/refresh",
  api(async () => {
    await clearCache();
    state = null;
    return { ok: true };
  }),
);

// Serve the built React app (web/dist) if present, so one process serves UI + API.
const webDist = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

app.listen(PORT, () => console.log(`Sleeper GM API on http://localhost:${PORT}`));
