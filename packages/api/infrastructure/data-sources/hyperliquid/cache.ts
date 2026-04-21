export type CacheSlot<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

export const resolveWithCache = <T>(
  slot: CacheSlot<T>,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> => {
  const now = Date.now();
  if (slot.value !== undefined && slot.expiresAt > now) {
    return Promise.resolve(slot.value);
  }
  if (slot.inFlight) {
    return slot.inFlight;
  }

  const request = loader()
    .then((value) => {
      slot.value = value;
      slot.expiresAt = Date.now() + ttlMs;
      return value;
    })
    .finally(() => {
      slot.inFlight = undefined;
    });

  slot.inFlight = request;
  return request;
};
