import { getLeagueId, loadContext, loadKeeperData, loadLeagueBrain, worthSource } from "@sgm/core";
import { heading, table } from "../format";

export async function brain(): Promise<void> {
  const ctx = await loadContext(getLeagueId());
  const data = await loadKeeperData(ctx);
  const { profiles, superlatives, generatedNote } = await loadLeagueBrain(ctx, data);

  console.log(heading(`League Brain — team profiles & superlatives (${worthSource()})`));
  console.log(` ${generatedNote}.`);

  console.log(heading("Superlatives"));
  for (const s of superlatives) {
    console.log(` ${s.emoji}  ${s.title}: ${s.teamName} (${s.manager}) — ${s.stat}`);
    console.log(`      ${s.blurb}`);
  }

  console.log(heading("Team profiles (by contender index)"));
  console.log(
    table(profiles, [
      { header: "Team", get: (p) => p.teamName },
      { header: "Idx", get: (p) => String(p.contenderIndex), align: "right" },
      { header: "Archetype", get: (p) => p.archetype },
      { header: "Value", get: (p) => `$${p.rosterValue}`, align: "right" },
      { header: "Keepers", get: (p) => `$${p.keeperSurplus}`, align: "right" },
      { header: "Trades", get: (p) => String(p.tradeCount), align: "right" },
      { header: "Picks", get: (p) => String(p.rookiePicks), align: "right" },
      { header: "Tags", get: (p) => (p.tags.length ? p.tags.join(", ") : "—") },
    ]),
  );
  console.log("");
  for (const p of profiles) console.log(` ${p.teamName}: ${p.scouting}`);
}
