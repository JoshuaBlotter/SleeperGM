// Per-team "which players am I keeping" set, persisted in localStorage and shared across the Team page's
// sub-tabs (Keepers ↔ Targets). The Keepers sim writes it; the Targets assistant reads it to compute
// your needs/stacks/diversity. Seeded from the recommended keepers the first time a team is opened.
import { useEffect, useState } from "react";

const key = (teamId: number) => `sgm.kept.v1.${teamId}`;

export function getKept(teamId: number): Set<string> {
  try {
    const raw = localStorage.getItem(key(teamId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}
export function hasKept(teamId: number): boolean {
  return localStorage.getItem(key(teamId)) !== null;
}
export function setKept(teamId: number, ids: Set<string>) {
  localStorage.setItem(key(teamId), JSON.stringify([...ids]));
  window.dispatchEvent(new Event("sgm-kept"));
}

/** Subscribe to a team's kept set. Returns [set, setter]; updates on edits in this tab and other tabs. */
export function useKept(teamId: number | null): [Set<string>, (ids: Set<string>) => void] {
  const [set, setSet] = useState<Set<string>>(() => (teamId == null ? new Set() : getKept(teamId)));
  useEffect(() => {
    if (teamId == null) return;
    setSet(getKept(teamId));
    const h = () => setSet(getKept(teamId));
    window.addEventListener("sgm-kept", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("sgm-kept", h);
      window.removeEventListener("storage", h);
    };
  }, [teamId]);
  return [set, (ids) => teamId != null && setKept(teamId, ids)];
}
