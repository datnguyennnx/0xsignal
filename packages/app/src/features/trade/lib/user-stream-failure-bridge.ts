import type { UserStreamFailure } from "./user-stream-types";

/**
 * Entry-safe mirror of the account stream's failure state.
 *
 * `app-toasters` must decide whether to load the failure-toast chunk, but the
 * stream client that owns the state is behind the lazy account-stream graph.
 * This module carries only the value and its listeners, so the shell can read
 * it without importing the Hyperliquid SDK.
 */
let snapshot: UserStreamFailure | null = null;
const listeners = new Set<(failure: UserStreamFailure | null) => void>();

export function getStreamFailureSnapshot(): UserStreamFailure | null {
  return snapshot;
}

export function subscribeStreamFailure(
  listener: (failure: UserStreamFailure | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the default stream client whenever its failure state changes. */
export function publishStreamFailure(failure: UserStreamFailure | null): void {
  snapshot = failure;
  for (const listener of listeners) listener(failure);
}
