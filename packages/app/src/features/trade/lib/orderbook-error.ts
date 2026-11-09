/**
 * The order book error is derived, not stored: a live socket always means the
 * last transient failure is resolved. Deriving it during render avoids a frame
 * where `isConnected` is already true but the stale error is still on screen.
 */
export function selectOrderbookError(rawError: string | null, isConnected: boolean): string | null {
  return isConnected ? null : rawError;
}
