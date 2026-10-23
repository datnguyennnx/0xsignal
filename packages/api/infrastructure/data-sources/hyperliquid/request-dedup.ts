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
 *
 * Keys identify the exact upstream request (`metaAndAssetCtxs:<dex>`), so two
 * callers that need the same read share it even when they asked for different
 * symbols.
 */

type AllMids = Record<string, string>;
type PerpDexs = Array<null | { name: string }>;
type MetaAndAssetCtxs = [unknown, unknown];

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Wrap a Promise-returning function with in-flight dedup.
 *
 * @param key Unique identity for the upstream request (e.g. "allMids").
 * @param fetcher The actual upstream call (returns a Promise).
 * @returns A Promise that resolves (or rejects) with the same result as fetcher,
 *          shared across all concurrent callers with the same key.
 */
export function withDedup(key: "allMids", fetcher: () => Promise<AllMids>): Promise<AllMids>;
export function withDedup(key: "perpDexs", fetcher: () => Promise<PerpDexs>): Promise<PerpDexs>;
export function withDedup(
  key: `metaAndAssetCtxs:${string}`,
  fetcher: () => Promise<MetaAndAssetCtxs>,
): Promise<MetaAndAssetCtxs>;
export function withDedup(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
  const existing = inFlight.get(key);
  if (existing !== undefined) return existing;

  const promise = fetcher().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
