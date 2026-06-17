import { QueryClient } from "@tanstack/react-query";

const GC_TIMES = {
  default: 5 * 60 * 1000,
  chart: 10 * 60 * 1000, // chart data is large
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,

      gcTime: GC_TIMES.default,

      retry: (failureCount, error) => {
        if (error instanceof Error) {
          if (error.message.includes("404") || error.message.includes("Unauthorized")) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,

      structuralSharing: true,

      networkMode: "online",
    },
    mutations: {
      retry: 0,
      networkMode: "online",
    },
  },
});
