import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-error";
import { UnauthenticatedError } from "@/lib/api-base";

const GC_TIMES = {
  default: 5 * 60 * 1000,
  chart: 10 * 60 * 1000, // chart data is large
} as const;

/** Auth failures and missing resources are terminal regardless of the message text. */
const NON_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (error instanceof UnauthenticatedError) return false;
  if (
    error instanceof ApiError &&
    error.status !== undefined &&
    NON_RETRYABLE_STATUSES.has(error.status)
  ) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,

      gcTime: GC_TIMES.default,

      retry: shouldRetryQuery,
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
