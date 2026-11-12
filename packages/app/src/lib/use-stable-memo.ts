import { useState } from "react";

interface StableMemoCache<T> {
  readonly key: string;
  readonly result: T;
}

/**
 * Recomputes `build(value)` only when `key` changes, so a caller can key an
 * expensive derivation off a cheap identity while still reading fresh data.
 */
export function useStableMemo<T, V>(build: (value: V) => T, key: string, value: V): T {
  const [cache, setCache] = useState<StableMemoCache<T>>(() => ({ key, result: build(value) }));

  if (cache.key !== key) {
    setCache({ key, result: build(value) });
  }

  return cache.result;
}
