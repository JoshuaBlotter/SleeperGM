#!/usr/bin/env -S npx tsx
import { Command } from "commander";
import { dashboard } from "./commands/dashboard";
import { team } from "./commands/team";
import { rulebook } from "./commands/rulebook";
import { keepers } from "./commands/keepers";
import { simulate } from "./commands/simulate";
import { inflation } from "./commands/inflation";
import { trades } from "./commands/trades";
import { values } from "./commands/values";
import { rookies } from "./commands/rookies";
import { draftValue } from "./commands/draftValue";
import { history } from "./commands/history";
import { scarcity } from "./commands/scarcity";
import { tiers } from "./commands/tiers";
import { brain } from "./commands/brain";
import { refresh } from "./commands/refresh";

const program = new Command();
program
  .name("sgm")
  .description("Sleeper GM — keeper/value/trade helper for league 'Los Socios'")
  .version("0.1.0");

program.command("dashboard").description("List all teams with records").action(run(dashboard));

program
  .command("team")
  .argument("<query>", "team name or roster number")
  .description("Single-team view: players, acquisition cost, years kept, keeper cost")
  .action(run(team));

program.command("rulebook").description("Show resolved house rules (flags outstanding ones)").action(run(rulebook));

program
  .command("keepers")
  .argument("[query]", "team name or roster number (omit for all teams)")
  .option("-i, --inflated", "adjust worth for league auction inflation")
  .description("Keeper board sorted by surplus (worth - keeper cost)")
  .action(run(keepers));

program
  .command("inflation")
  .description("League auction inflation from keeper surplus")
  .action(run(inflation));

program
  .command("trades")
  .argument("<query>", "your team name or roster number")
  .option("-p, --partner <query>", "limit to one partner team")
  .option("-n, --top <n>", "how many rows per section")
  .option("-s, --sharky", "show one-sided surplus-max swaps instead of mutual-fit")
  .description("Trade chips, buy-low targets, and mutual-fit swaps")
  .action(run(trades));

program
  .command("simulate")
  .requiredOption("-t, --team <query>", "team name or roster number")
  .option("-k, --keep <names>", "comma-separated player names/ids to keep")
  .description("Cap impact of a chosen keeper set")
  .action(run(simulate));

program
  .command("values")
  .option("-t, --team <query>", "also show worth for one team")
  .description("Value sources: active source, coverage, unmatched players")
  .action(run(values));

program
  .command("rookies")
  .description("Rookie draft board: derived order, pick ownership (traded picks), slot cost, draft capital")
  .action(run(rookies));

program
  .command("draft-value")
  .description("Last year's auction buys vs this year's projected worth (historical draft value)")
  .action(run(draftValue));

program
  .command("history")
  .description("Last season's rookie + auction draft recap, and the salary ledger it escalates into")
  .action(run(history));

program
  .command("scarcity")
  .description("Positional scarcity: how much of each position's top tier is kept vs available")
  .action(run(scarcity));

program
  .command("tiers")
  .description("Value tiers by position (gap-clustered draft tiers)")
  .action(run(tiers));

program
  .command("brain")
  .description("League Brain: team profiles (archetype/tendencies/scouting) + league superlatives")
  .action(run(brain));

program.command("refresh").description("Clear the API cache").action(run(refresh));

/** Wrap an async action so errors print cleanly and set a non-zero exit code. */
function run<A extends unknown[]>(fn: (...args: A) => void | Promise<void>) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  };
}

program.parseAsync();
