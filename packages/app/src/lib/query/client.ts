import { QueryClient } from "@tanstack/react-query";

// Default stale times by data type
const STALE_TIMES = {
  chart: 60 * 1000, // 1 minute - chart data updates less frequently
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
      staleTime: STALE_TIMES.chart,

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
