/**
 * Resume resync.
 *
 * React Query has `refetchOnWindowFocus` disabled, so nothing notices that the
 * page sat hidden through OS sleep, back/forward-cache restore, or tab discard
 * and that the cached charts and positions are now stale. `page-visibility`
 * already coalesces the platform-specific suspend/resume signals into one
 * callback each; this module only decides whether the hidden gap was long
 * enough (or the page was discarded) to warrant a refetch, then fans out one
 * invalidation per affected key root.
 *
 * SSR-safe: `onPageSuspend` / `onPageResume` are no-ops without a `document`.
 */

import { onPageResume, onPageSuspend, wasPageDiscarded } from "@/lib/page-visibility";
import { queryClient } from "@/lib/query-client";

/** A hide shorter than this is an ordinary tab switch and stays cached. */
export const RESUME_RESYNC_AFTER_MS = 5 * 60_000;

/** Roots whose cached data can silently drift while the page is suspended. */
const RESYNC_ROOTS = ["user", "whales", "market"] as const;

export type InvalidateQuery = (queryKey: readonly string[]) => void;

/** Pure decision: did the page miss enough time, or was it discarded? */
export function shouldResync(hiddenAt: number | null, now: number, discarded: boolean): boolean {
  if (discarded) return true;
  if (hiddenAt === null) return false;
  return now - hiddenAt >= RESUME_RESYNC_AFTER_MS;
}

const invalidateDefault: InvalidateQuery = (queryKey) => {
  // Only observed keys need a network read; unobserved ones can wait for mount.
  void queryClient.invalidateQueries({ queryKey, refetchType: "active" });
};

let hiddenAt: number | null = null;
let uninstall: (() => void) | null = null;
/**
 * `document.wasDiscarded` stays true for the rest of the document's life after
 * a bfcache restore, so treat it as a one-shot signal per install.
 */
let discardHandled = false;

/**
 * Install the shared resume listener once; later calls return the same
 * idempotent uninstall instead of stacking another listener.
 */
export function installResumeResync(invalidate: InvalidateQuery = invalidateDefault): () => void {
  if (uninstall !== null) return uninstall;

  const stopSuspend = onPageSuspend(() => {
    hiddenAt = Date.now();
  });

  const stopResume = onPageResume(() => {
    const hiddenSince = hiddenAt;
    hiddenAt = null;

    const discarded = !discardHandled && wasPageDiscarded();
    if (discarded) discardHandled = true;

    if (!shouldResync(hiddenSince, Date.now(), discarded)) return;
    for (const root of RESYNC_ROOTS) invalidate([root]);
  });

  let active = true;
  const teardown = (): void => {
    if (!active) return;
    active = false;

    stopSuspend();
    stopResume();
    hiddenAt = null;
    discardHandled = false;
    if (uninstall === teardown) uninstall = null;
  };

  uninstall = teardown;
  return teardown;
}
