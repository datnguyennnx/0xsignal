/**
 * User reads prefer the direct WS stream, but a browser that cannot reach
 * Hyperliquid must still get data. The REST fallback therefore waits a short
 * grace period: a stream that wins the race means the REST read is never issued.
 */
export const USER_STREAM_REST_GRACE_MS = 800;

export interface RestFallbackGate {
  /** Mark the stream live (`true`) or unconfirmed (`false`). */
  setLive(live: boolean): void;
  isRestEnabled(): boolean;
  dispose(): void;
}

export function createRestFallbackGate(
  onOpen: () => void,
  graceMs: number = USER_STREAM_REST_GRACE_MS,
): RestFallbackGate {
  let opened = false;
  let hasBeenLive = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const open = (): void => {
    if (opened) return;
    opened = true;
    clear();
    onOpen();
  };

  const schedule = (): void => {
    if (opened || timer !== null) return;
    timer = setTimeout(open, graceMs);
  };

  return {
    setLive: (live) => {
      if (live) {
        hasBeenLive = true;
        clear();
        return;
      }
      // Once a stream had been confirmed, a disconnect is a real outage: fall
      // back immediately instead of leaving the consumer on stale data.
      if (hasBeenLive) open();
      else schedule();
    },
    isRestEnabled: () => opened,
    dispose: clear,
  };
}
