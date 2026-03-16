import { QueryClient } from "@tanstack/react-query";

// Default stale times by data type
const STALE_TIMES = {
  prices: 20 * 1000, // 20 seconds - prices change frequently
  chart: 60 * 1000, // 1 minute - chart data updates less frequently
  globalMarket: 60 * 1000, // 1 minute
  models: 60 * 60 * 1000, // 1 hour - models don't change often
} as const;

// Garbage collection times
const GC_TIMES = {
  default: 5 * 60 * 1000, // 5 minutes
  chart: 10 * 60 * 1000, // 10 minutes - chart data is large
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data freshness strategy
      staleTime: STALE_TIMES.prices,

      // Garbage collection - v5 uses gcTime instead of cacheTime
      gcTime: GC_TIMES.default,

      // Retry strategy with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry on 404s or auth errors
        if (error instanceof Error) {
          if (error.message.includes("404") || error.message.includes("Unauthorized")) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch strategy
      refetchOnWindowFocus: false, // Disable by default for trading app
      refetchOnReconnect: true,
      refetchOnMount: true,

      // Performance optimizations
      notifyOnChangeProps: "all",
      structuralSharing: true, // Deeply compares data to prevent re-renders

      // Network mode for offline support
      networkMode: "online",
    },
    mutations: {
      // Mutation defaults
      retry: 0, // Don't retry mutations by default
      networkMode: "online",
    },
  },
});

// Helper to get optimized query options by type
export const getQueryOptions = {
  prices: {
    staleTime: STALE_TIMES.prices,
    gcTime: GC_TIMES.default,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  },
  chart: {
    staleTime: STALE_TIMES.chart,
    gcTime: GC_TIMES.chart,
  },
  globalMarket: {
    staleTime: STALE_TIMES.globalMarket,
    gcTime: GC_TIMES.default,
    refetchInterval: 120 * 1000, // Auto-refresh every 2 minutes
  },

  models: {
    staleTime: STALE_TIMES.models,
    gcTime: GC_TIMES.default,
  },
} as const;

// Prefetch helper for route preloading
export const prefetchQueries = {
  prices: (limit: number) =>
    queryClient.prefetchQuery({
      queryKey: ["prices", "list", limit],
      staleTime: STALE_TIMES.prices,
    }),

  globalMarket: () =>
    queryClient.prefetchQuery({
      queryKey: ["global-market", "overview"],
      staleTime: STALE_TIMES.globalMarket,
    }),
};
