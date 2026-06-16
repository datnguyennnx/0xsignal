import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1440px)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  const handler = () => callback();
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return true; // SSR fallback — 1440px+
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
