// Tiny, dependency-free terminal formatting helpers.

export function money(n: number): string {
  const s = `$${Math.abs(n)}`;
  return n < 0 ? `-${s}` : s;
}

export function signedMoney(n: number): string {
  return n > 0 ? `+$${n}` : n < 0 ? `-$${Math.abs(n)}` : "$0";
}

export function record(w: number, l: number, t: number): string {
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

export interface Column<T> {
  header: string;
  get: (row: T) => string;
  align?: "left" | "right";
}

/** Render a simple fixed-width table. */
export function table<T>(rows: T[], columns: Column<T>[]): string {
  const cells = rows.map((r) => columns.map((c) => c.get(r)));
  const widths = columns.map((c, i) =>
    Math.max(c.header.length, ...cells.map((row) => row[i]!.length)),
  );
  const pad = (s: string, w: number, align?: "left" | "right") =>
    align === "right" ? s.padStart(w) : s.padEnd(w);

  const head = columns.map((c, i) => pad(c.header, widths[i]!, c.align)).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const body = cells.map((row) => row.map((s, i) => pad(s, widths[i]!, columns[i]!.align)).join("  "));
  return [head, sep, ...body].join("\n");
}

export function heading(text: string): string {
  return `\n${text}\n${"=".repeat(text.length)}`;
}
