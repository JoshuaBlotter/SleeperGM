import { useEffect, useState } from "react";

export function money(n: number): string {
  return n < 0 ? `-$${Math.abs(n)}` : `$${n}`;
}
export function signed(n: number): string {
  return n > 0 ? `+$${n}` : n < 0 ? `-$${Math.abs(n)}` : "$0";
}
export function record(w: number, l: number, t: number): string {
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: string; loading: boolean } {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    fn()
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e) => alive && setState({ error: e instanceof Error ? e.message : String(e), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** True above the one breakpoint (760px). Lets a view render a table on desktop and rows on a phone. */
export function useIsDesktop(): boolean {
  const [is, setIs] = useState(() => window.matchMedia("(min-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 760px)");
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener("change", on);
    // Belt and braces: some viewport changes (device emulation, iPad split view) resize
    // without dispatching a MediaQueryList change event.
    window.addEventListener("resize", on);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return is;
}

export function Surplus({ value }: { value: number }) {
  const cls = value > 0 ? "pos" : value < 0 ? "neg" : "zero";
  return <span className={`num ${cls}`}>{signed(value)}</span>;
}

const CALL_ROLE: Record<"keep" | "hold" | "cut", string> = { keep: "chip-success", hold: "chip-warning", cut: "chip-danger" };

export function Call({ rec }: { rec: "keep" | "hold" | "cut" }) {
  return <span className={`chip chip-solid ${CALL_ROLE[rec]}`}>{rec}</span>;
}

export function Loading({ what }: { what: string }) {
  return <div className="notice">Loading {what}… <span className="dim">(first load builds league history — a few seconds)</span></div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="notice error">Error: {message}</div>;
}
