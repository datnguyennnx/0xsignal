import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

let snapshot = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = Date.now();
  for (const listener of listeners) listener();
}

/**
 * One minute clock for the whole app, shared by every subscriber. Mounting one
 * interval per panel would tick independently; this ticks once and fans out.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(emit, MINUTE_MS);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
}

function getSnapshot(): number {
  return snapshot;
}

export function useNow(): Date {
  return new Date(useSyncExternalStore(subscribe, getSnapshot, getSnapshot));
}
