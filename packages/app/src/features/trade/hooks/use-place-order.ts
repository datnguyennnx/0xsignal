import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { PlaceOrderRequest } from "@/services/api";
import { UnauthenticatedError } from "@/lib/api-base";
import { useHyperliquidMeta } from "./use-hyperliquid-meta";
import { cancelAndInvalidateUserQueries, placeOrderUserQueryKeys } from "./user-query-invalidation";

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
  const { getPrecision } = useHyperliquidMeta();

  return useMutation({
    mutationFn: async (params: PlaceOrderRequest) => {
      if (address === undefined) {
        throw new UnauthenticatedError("Connect a wallet to place an order");
      }
      const { submitPlaceOrder } = await import("@/services/exchange");
      return submitPlaceOrder(params, {
        address,
        chainId,
        provider: window.ethereum,
        confirm: (message) => window.confirm(message),
        szDecimals: getPrecision(params.orders[0].symbol).szDecimals,
      });
    },
    onSuccess: () => {
      if (address !== undefined) {
        void cancelAndInvalidateUserQueries(queryClient, placeOrderUserQueryKeys(address));
      }
    },
    ...(onError !== undefined && { onError }),
  });
}
