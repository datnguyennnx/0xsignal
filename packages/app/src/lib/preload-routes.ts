import { useEffect } from "react";
import { api } from "@/services/api";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

/** How long the idle scheduler may wait for a free window before forcing the run. */
const IDLE_TIMEOUT_MS = 2000;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Runs after first paint at the first idle window, never inside the load. */
function scheduleIdle(run: () => void): () => void {
  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback !== "function") {
    const timer = setTimeout(run, IDLE_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }
  const handle = idleWindow.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  return () => {
    idleWindow.cancelIdleCallback?.(handle);
  };
}

// One route is deliberately left out: it statically pulls a charting library
// that would then be parsed inside the idle window of the first load.
function preloadHeavyRoutes(): void {
  void import("@/pages/asset-detail");
  void import("@/pages/whales");
  void import("@/features/chart/components/trading-chart");
}

/** Warms the market cache and the heaviest route chunks after first paint. */
export function usePreloadRoutes(): void {
  useEffect(() => {
    void queryClient
      .query({
        queryKey: queryKeys.market.meta(),
        queryFn: () => api.getMarkets(),
        staleTime: 5 * 60 * 1000,
        retry: false,
      })
      .catch(() => null);

    // In dev the route prefetch only re-transforms lazy chunks the user may never open.
    const cancelPreload = import.meta.env.PROD ? scheduleIdle(preloadHeavyRoutes) : undefined;
    return () => cancelPreload?.();
  }, []);
}
