/**
 * Minimal in-flight request deduplication (NOT caching, NOT rate limiting).
 *
 * When multiple callers request the same upstream resource concurrently,
 * only ONE call is made to the upstream. All callers share the same
 * in-flight Promise and receive the same result.
 *
 * Once the call completes (success or failure), the entry is removed.
 * The next caller will make a fresh request — no stale data.
 *
 * This uses plain Promises (not Effect Ref/Deferred) because:
 * - The underlying SDK calls are Promise-based
 * - Promise creation/completion is naturally atomic in JS
 * - No race conditions in single-threaded runtime
 * - No TypeScript complexity with generic Effect types
 */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Wrap a Promise-returning function with in-flight dedup.
 *
 * @param key Unique identity for the request (e.g. "allMids").
 * @param fetcher The actual upstream call (returns a Promise).
 * @returns A Promise that resolves (or rejects) with the same result as fetcher,
 *          shared across all concurrent callers with the same key.
 */
export const withDedup = <A>(key: string, fetcher: () => Promise<A>): Promise<A> => {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<A>;

  const promise = fetcher().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
};
