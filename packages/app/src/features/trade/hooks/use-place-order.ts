import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { PlaceOrderRequest } from "@/services/api";
import { submitPlaceOrder } from "@/services/exchange";
import { UnauthenticatedError } from "@/lib/api-base";
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
  const { address, chainId } = useConnection();

  return useMutation({
    mutationFn: (params: PlaceOrderRequest) => {
      if (address === undefined) {
        throw new UnauthenticatedError("Connect a wallet to place an order");
      }
      return submitPlaceOrder(params, {
        address,
        chainId,
        provider: window.ethereum,
        confirm: (message) => window.confirm(message),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
    ...(onError !== undefined && { onError }),
  });
}
