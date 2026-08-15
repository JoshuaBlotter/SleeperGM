// Bake ESPN "Live Draft Trends" into config/values/espn-trends.csv (a static, committed value source).
//
// Unlike espn.csv, there's no clean endpoint for the live AVG SALARY table — it's rendered client-side
// and gated. So this is paste-driven: copy the whole "Live Draft Trends" table from ESPN into a text
// file and point this script at it. All the noise (repeated names, injury tags, D/ST, WSH) is handled
// by `parseEspnTrends`; this script is just IO. The RAW ESPN salary is kept as-is (ESPN already prices
// a $200 auction; the site's inflation control does any league scaling).
//
// Usage: npm run values:espn-trends -- <paste-file.txt>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEspnTrends } from "@sgm/core";

function main() {
  const src = process.argv[2];
  if (!src) throw new Error("Usage: npm run values:espn-trends -- <paste-file.txt>");

  const raw = readFileSync(src, "utf8");
  const rows = parseEspnTrends(raw);
  if (!rows.length) throw new Error(`No priced players parsed from ${src} — is it the Live Draft Trends table?`);

  const header = "name,position,team,value";
  const lines = rows.map((r) => `${csv(r.name)},${r.position ?? ""},${r.team ?? ""},${r.value}`);
  const outDir = path.join(process.cwd(), "config", "values");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "espn-trends.csv");
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    out,
    [
      `# ESPN Live Draft Trends — raw average live-draft salary, ESPN $200 auction (imported ${today})`,
      header,
      ...lines,
    ].join("\n") + "\n",
  );
  const top = rows.slice(0, 5).map((r) => `${r.name} $${r.value}`).join(", ");
  console.log(`Wrote ${out} (${rows.length} players). Top: ${top}`);
}

function csv(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
