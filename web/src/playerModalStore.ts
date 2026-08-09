// Global "which player drilldown is open" state, so any table row anywhere can open the modal without
// prop-drilling. Same lightweight event pattern as the overrides store.
import { useEffect, useState } from "react";

let current: string | null = null;

export function openPlayer(playerId: string) {
  current = playerId;
  window.dispatchEvent(new Event("sgm-player"));
}
export function closePlayer() {
  current = null;
  window.dispatchEvent(new Event("sgm-player"));
}
export function useOpenPlayer(): string | null {
  const [id, setId] = useState<string | null>(current);
  useEffect(() => {
    const h = () => setId(current);
    window.addEventListener("sgm-player", h);
    return () => window.removeEventListener("sgm-player", h);
  }, []);
  return id;
}
