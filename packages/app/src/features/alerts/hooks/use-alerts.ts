import { useQuery } from "@tanstack/react-query";

import { toAsyncState } from "@/lib/async-state";
import { queryKeys } from "@/lib/query-keys";
import { listAlerts } from "@/services/api/alerts";

function alertsQueryOptions() {
  return {
    queryKey: queryKeys.alerts.list(),
    queryFn: () => listAlerts(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  };
}

export function useAlerts() {
  const result = useQuery(alertsQueryOptions());

  const state = toAsyncState({
    isPending: result.isPending,
    isFetching: result.isFetching,
    isError: result.isError,
    error: result.error,
    data: result.data,
    isEmpty: (data) => data.length === 0,
    emptyReason: "first-use",
  });

  return { ...result, state };
}
