export type CacheSlot<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
  /** Schema version of the cached value. Mismatch forces re-fetch. */
  schemaVersion?: number;
};

/** Bump when AggregatedTradeAsset shape changes. Keep in sync with FRONTEND_MARKET_SCHEMA_VERSION (App.tsx). */
export const MARKET_SCHEMA_VERSION = 2;

export const resolveWithCache = <T>(
  slot: CacheSlot<T>,
  ttlMs: number,
  loader: () => Promise<T>,
  schemaVersion?: number
): Promise<T> => {
  const now = Date.now();
  const versionMatch = schemaVersion === undefined || slot.schemaVersion === schemaVersion;
  if (slot.value !== undefined && slot.expiresAt > now && versionMatch) {
    return Promise.resolve(slot.value);
  }
  // Schema version mismatch or stale — ignore stale value
  if (slot.inFlight) {
    return slot.inFlight;
  }

  const request = loader()
    .then((value) => {
      slot.value = value;
      slot.schemaVersion = schemaVersion;
      slot.expiresAt = Date.now() + ttlMs;
      return value;
    })
    .finally(() => {
      slot.inFlight = undefined;
    });

  slot.inFlight = request;
  return request;
};
