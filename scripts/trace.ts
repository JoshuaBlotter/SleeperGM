// Debug tool: trace a player's full draft + transaction (acquisition) timeline across the chain.
// Usage: npm run sgm:trace -- "a.j. brown"
// Shows every draft pick AND every add (waiver/free-agent/trade) with the receiving owner + season,
// so we can see exactly when each manager acquired the player (to reconcile keeper salaries).

import { buildChain, getLeagueId, loadRegistry, sleeper } from "@sgm/core";

async function main() {
  const q = (process.argv[2] ?? "").toLowerCase();
  if (!q) throw new Error(`Usage: npm run sgm:trace -- "<name substring>"`);

  const chain = await buildChain(getLeagueId());
  const registry = await loadRegistry(getLeagueId());
  const ownerName = new Map(registry.map((t) => [t.ownerUserId ?? "", `${t.teamName}`]));
  const name = (uid: string | undefined) => (uid && ownerName.get(uid)) || uid || "?";

  // Find matching player_ids from draft metadata names.
  const idsByName = new Map<string, string>();
  const draftEvents: string[] = [];
  const addEvents: string[] = [];

  for (const link of chain) {
    const drafts = (await sleeper.getDrafts(link.leagueId)) ?? [];
    const rosterOwner = new Map<number, string>();
    for (const r of (await sleeper.getRosters(link.leagueId)) ?? []) if (r.owner_id) rosterOwner.set(r.roster_id, r.owner_id);

    for (const d of drafts) {
      const picks = ((await sleeper.getDraftPicks(d.draft_id)) ?? []) as any[];
      for (const p of picks) {
        const nm = `${p.metadata?.first_name ?? ""} ${p.metadata?.last_name ?? ""}`.trim();
        if (!nm.toLowerCase().includes(q)) continue;
        idsByName.set(p.player_id, nm);
        const cost = d.type === "auction" ? `$${p.metadata?.amount ?? "?"}` : `rookie ${p.round}.${String(p.draft_slot).padStart(2, "0")}`;
        draftEvents.push(`  ${link.season}  DRAFT ${d.type.padEnd(7)} ${cost.padEnd(13)} by ${name(p.picked_by)}  [${nm}]`);
      }
    }
  }

  const ids = new Set(idsByName.keys());
  for (const link of chain) {
    const rosterOwner = new Map<number, string>();
    for (const r of (await sleeper.getRosters(link.leagueId)) ?? []) if (r.owner_id) rosterOwner.set(r.roster_id, r.owner_id);
    for (let week = 1; week <= 18; week++) {
      const txns = (await sleeper.getTransactions(link.leagueId, week)) ?? [];
      for (const t of txns) {
        if (t.status !== "complete" || !t.adds) continue;
        for (const [pid, rosterId] of Object.entries(t.adds)) {
          if (!ids.has(pid)) continue;
          const bid = t.type === "waiver" ? ` $${t.settings?.waiver_bid ?? 0}` : "";
          addEvents.push(`  ${link.season} w${String(week).padStart(2)}  ${t.type.padEnd(11)}${bid.padEnd(5)} -> ${name(rosterOwner.get(rosterId))}  [${idsByName.get(pid)}]`);
        }
      }
    }
  }

  if (!idsByName.size) {
    console.log(`No draft events for "${q}".`);
    return;
  }
  console.log(`Timeline for "${q}" (ids: ${[...ids].join(", ")}):\n`);
  console.log("DRAFTS:");
  for (const e of draftEvents.sort()) console.log(e);
  console.log("\nADDS (waiver / free agent / trade):");
  for (const e of addEvents.sort()) console.log(e);
  console.log(`\n(newest-relevant = when the current owner got them; base salary + escalation flow from there)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
