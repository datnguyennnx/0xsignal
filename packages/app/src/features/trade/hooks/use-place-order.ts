import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PlaceOrderRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * Shared hook for the placeOrder mutation used in both
 * order-form and position-management.
 *
 * On success, invalidates clearinghouse state + open orders.
 * Error handling (e.g. wallet prompt) is delegated to the caller
 * via the `onError` callback.
 */
export function usePlaceOrder(onError?: (err: Error) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: PlaceOrderRequest) => api.placeOrder(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
    onError,
  });
}
