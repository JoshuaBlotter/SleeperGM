// Last season's draft recap and the salary ledger that follows from it (#20). PURE.
//
// The commissioner's job every offseason is to check that each keeper's new salary follows from last
// season's: what the player cost then, what the escalation rule adds, what they cost now. The app had
// the two ends of that in two different places and the arithmetic between them nowhere, so the check
// meant rebuilding it by hand in a spreadsheet.
//
// This puts it in one table. `auction` and `rookie` recap how last season's board actually went;
// `ledger` is every player on a roster today with last season's salary, the delta, and this season's —
// the thing a manager exports and reconciles against the workbook.

import type { SalaryEvent, SalarySeason } from "./salaryHistory";

/** One pick from last season's draft board (auction bid or linear rookie pick). */
export interface RecapDraftPick {
  playerId: string;
  kind: "auction" | "rookie";
  pickNo: number;
  round: number;
  slot: number;
  /** The salary the pick set: the auction bid, or the rookie table's figure for that slot (§6.4). */
  salary: number;
  byTeam: string | null; // who made the pick, in that season
}

/** What the rest of the app already knows about a player, joined in per row. */
export interface RecapPlayerFacts {
  name: string;
  position: string;
  nflTeam: string | null;
  salaryHistory: SalarySeason[]; // empty when the player is no longer on a roster
  rostered: boolean;
  ownerTeam: string | null; // who rosters them NOW
  thisSalary: number | null; // keeper salary for the upcoming season
}

export interface RecapRow {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string | null;
  basis: SalaryEvent; // how last season's salary was set
  note: string | null; // "R1.04" for a rookie pick
  pickNo: number | null; // draft board order; null on a ledger row that wasn't drafted
  byTeam: string | null; // who drafted them last season
  lastSalary: number | null; // last season's salary (null = wasn't in the league yet)
  lastSource: SalarySeason["source"] | null;
  approximate: boolean; // last season's number is a replay the salary sheet contradicts
  thisSalary: number | null; // this season's keeper salary (null = no longer rostered)
  delta: number | null; // thisSalary - lastSalary
  rostered: boolean;
  ownerTeam: string | null;
}

export interface SeasonRecap {
  season: string; // the season being recapped
  nextSeason: string; // the season the salaries escalate into
  auction: RecapRow[]; // last season's auction, priciest first
  rookie: RecapRow[]; // last season's rookie draft, in pick order
  ledger: RecapRow[]; // every currently rostered player, priciest THIS season first
  totals: {
    auctionSpend: number;
    auctionPicks: number;
    rookiePicks: number;
    ledgerLast: number; // sum of last season's salaries for players still rostered
    ledgerThis: number;
    ledgerDelta: number;
  };
}

const MISSING: RecapPlayerFacts = {
  name: "(unknown player)", position: "?", nflTeam: null, salaryHistory: [], rostered: false, ownerTeam: null, thisSalary: null,
};

export function buildSeasonRecap(input: {
  season: string;
  nextSeason: string;
  auctionPicks: RecapDraftPick[];
  rookiePicks: RecapDraftPick[];
  facts: Map<string, RecapPlayerFacts>;
}): SeasonRecap {
  const { season, nextSeason, facts } = input;

  // A drafted player's last-season salary is the pick itself — the auction bid, or the rookie table
  // figure — so it stands even for someone who has since been dropped and has no ladder left.
  const draftRow = (pick: RecapDraftPick): RecapRow => {
    const f = facts.get(pick.playerId) ?? MISSING;
    const at = f.salaryHistory.find((r) => r.season === season);
    return {
      ...base(pick.playerId, f),
      basis: pick.kind,
      note: pick.kind === "rookie" ? `R${pick.round}.${String(pick.slot).padStart(2, "0")}` : null,
      pickNo: pick.pickNo,
      byTeam: pick.byTeam,
      lastSalary: pick.salary,
      lastSource: "sleeper",
      approximate: at?.approximate ?? false,
      delta: f.thisSalary != null ? f.thisSalary - pick.salary : null,
    };
  };

  const ledger: RecapRow[] = [];
  for (const [playerId, f] of facts) {
    if (!f.rostered) continue;
    const at = f.salaryHistory.find((r) => r.season === season);
    const origin = f.salaryHistory[0];
    ledger.push({
      ...base(playerId, f),
      // No row for last season means the player wasn't here yet — show how they arrived instead.
      basis: at?.event ?? origin?.event ?? "unknown",
      note: at?.note ?? origin?.note ?? null,
      pickNo: null,
      byTeam: null,
      lastSalary: at?.salary ?? null,
      lastSource: at?.source ?? null,
      approximate: at?.approximate ?? false,
      delta: f.thisSalary != null && at ? f.thisSalary - at.salary : null,
    });
  }
  ledger.sort((a, b) => (b.thisSalary ?? 0) - (a.thisSalary ?? 0) || a.name.localeCompare(b.name));

  const auction = input.auctionPicks.map(draftRow).sort((a, b) => (b.lastSalary ?? 0) - (a.lastSalary ?? 0) || a.pickNo! - b.pickNo!);
  const rookie = input.rookiePicks.map(draftRow).sort((a, b) => a.pickNo! - b.pickNo!);

  return {
    season,
    nextSeason,
    auction,
    rookie,
    ledger,
    totals: {
      auctionSpend: auction.reduce((s, r) => s + (r.lastSalary ?? 0), 0),
      auctionPicks: auction.length,
      rookiePicks: rookie.length,
      ledgerLast: ledger.reduce((s, r) => s + (r.lastSalary ?? 0), 0),
      ledgerThis: ledger.reduce((s, r) => s + (r.thisSalary ?? 0), 0),
      ledgerDelta: ledger.reduce((s, r) => s + (r.delta ?? 0), 0),
    },
  };
}

function base(playerId: string, f: RecapPlayerFacts) {
  return {
    playerId,
    name: f.name,
    position: f.position,
    nflTeam: f.nflTeam,
    thisSalary: f.thisSalary,
    rostered: f.rostered,
    ownerTeam: f.ownerTeam,
  };
}
