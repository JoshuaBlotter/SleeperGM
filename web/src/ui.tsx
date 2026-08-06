import { useEffect, useState } from "react";

export function money(n: number): string {
  return n < 0 ? `-$${Math.abs(n)}` : `$${n}`;
}
export function signed(n: number): string {
  return n > 0 ? `+$${n}` : n < 0 ? `-$${Math.abs(n)}` : "$0";
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

export function Surplus({ value }: { value: number }) {
  const cls = value > 0 ? "pos" : value < 0 ? "neg" : "zero";
  return <span className={`num ${cls}`}>{signed(value)}</span>;
}

export function Call({ rec }: { rec: "keep" | "hold" | "cut" }) {
  return <span className={`badge ${rec}`}>{rec}</span>;
}

export function Loading({ what }: { what: string }) {
  return <div className="notice">Loading {what}… <span className="dim">(first load builds league history — a few seconds)</span></div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="notice error">Error: {message}</div>;
}
