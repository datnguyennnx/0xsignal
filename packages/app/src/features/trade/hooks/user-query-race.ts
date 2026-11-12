import { isPageHidden } from "@/lib/page-visibility";

/** Pace of the REST read while the user stream is not confirmed. */
const USER_REST_FALLBACK_MS = 30_000;

/**
 * When the newest WS frame landed for a query key. A REST read that started
 * before that instant must not overwrite the newer frame, so the queryFn
 * resolves to the cache instead of its own response.
 */
const lastWsWriteAt = new Map<string, number>();

/** Stamp the key so any REST read already in flight gets discarded on return. */
export function markUserDataWsWrite(queryKey: readonly unknown[]): void {
  lastWsWriteAt.set(JSON.stringify(queryKey), Date.now());
}

/**
 * Keep a WS frame that landed while the REST request was in flight. `startedAt`
 * is captured before the request; only a stamp strictly after it counts. The
 * guard itself never writes WS data, so it can never discard a newer frame —
 * it only drops the older REST response.
 */
export function resolveUserDataRestResult<T>(
  queryKey: readonly unknown[],
  startedAt: number,
  data: T,
  cached: () => T | undefined,
): T {
  const wsWriteAt = lastWsWriteAt.get(JSON.stringify(queryKey)) ?? 0;
  return wsWriteAt > startedAt ? (cached() ?? data) : data;
}

/** Poll the REST fallback only while the stream is not live and the tab is visible. */
export function userRestRefetchInterval(live: boolean): number | false {
  return !live && !isPageHidden() ? USER_REST_FALLBACK_MS : false;
}
