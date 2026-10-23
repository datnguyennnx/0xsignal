import { useEffect } from "react";
import { api } from "@/services/api";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

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
    let preloadTimer: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.PROD) {
      preloadTimer = setTimeout(() => {
        void import("@/pages/asset-detail");
        void import("@/pages/portfolio");
        void import("@/pages/whales");
        void import("@/features/chart/components/trading-chart");
      }, 2000);
    }
    return () => {
      clearTimeout(preloadTimer);
    };
  }, []);
}
