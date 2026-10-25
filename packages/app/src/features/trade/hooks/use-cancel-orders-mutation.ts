import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { CancelOrdersRequest } from "@0xsignal/shared";
import { submitCancelOrders } from "@/services/exchange";
import { useHyperliquidMeta } from "./use-hyperliquid-meta";
import { queryKeys } from "@/lib/query-keys";
import { UnauthenticatedError } from "@/lib/api-base";

export function useCancelOrdersMutation() {
  const queryClient = useQueryClient();
  const { address, chainId } = useConnection();
  const { getAssetIndex } = useHyperliquidMeta();
  return useMutation({
    mutationFn: (params: CancelOrdersRequest) => {
      if (address === undefined) {
        throw new UnauthenticatedError("Connect a wallet to cancel orders");
      }
      return submitCancelOrders(params, {
        address,
        chainId,
        provider: window.ethereum,
        confirm: () => true,
        assetIndex: getAssetIndex,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });
}
