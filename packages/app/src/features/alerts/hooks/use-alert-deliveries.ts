import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toAsyncState } from "@/lib/async-state";
import { queryKeys } from "@/lib/query-keys";
import {
  type AlertDeliveries,
  listAlertDeliveries,
  markAlertDeliveriesSeen,
} from "@/services/api/alerts";

function deliveriesQueryOptions() {
  return {
    queryKey: queryKeys.alerts.deliveries(),
    queryFn: () => listAlertDeliveries(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  };
}

export function useAlertDeliveries() {
  const result = useQuery(deliveriesQueryOptions());

  const state = toAsyncState({
    isPending: result.isPending,
    isFetching: result.isFetching,
    isError: result.isError,
    error: result.error,
    data: result.data,
    isEmpty: (data) => data.deliveries.length === 0,
    emptyReason: "first-use",
  });

  return { ...result, state };
}

export function useMarkDeliveriesSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAlertDeliveriesSeen,
    onSuccess: () => {
      queryClient.setQueryData<AlertDeliveries>(queryKeys.alerts.deliveries(), (previous) =>
        previous ? { ...previous, unread: 0 } : previous,
      );
    },
  });
}
