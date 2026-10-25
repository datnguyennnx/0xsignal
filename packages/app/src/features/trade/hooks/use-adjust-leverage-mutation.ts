import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import type { UpdateLeverageRequest } from "@/services/api";
import { submitUpdateLeverage } from "@/services/exchange";
import { queryKeys } from "@/lib/query-keys";
import { UnauthenticatedError } from "@/lib/api-base";
import { useAppStore } from "@/stores/use-app-store";

interface UseAdjustLeverageMutationParams {
  symbol: string;
  assetIndex: number;
  isCross: boolean;
  leverage: number;
  onConfirm?: ((newLeverage: number) => void) | undefined;
  onOpenChange: (open: boolean) => void;
}

export function useAdjustLeverageMutation({
  symbol,
  assetIndex,
  isCross,
  leverage,
  onConfirm,
  onOpenChange,
}: UseAdjustLeverageMutationParams) {
  const queryClient = useQueryClient();
  const { address, chainId } = useConnection();
  const isConnectWalletOpen = useAppStore(
    (s) => s.connectWalletOpen["trade-adjust-leverage"] ?? false,
  );
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("trade-adjust-leverage");
  }, []);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("trade-adjust-leverage");
  }, []);

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => {
      if (address === undefined) {
        throw new UnauthenticatedError("Connect a wallet to update leverage");
      }
      return submitUpdateLeverage(params, {
        address,
        chainId,
        provider: window.ethereum,
        confirm: () => true,
        assetIndex,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
      onConfirm?.(leverage);
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
        return;
      }
      console.error(`Failed to update leverage for ${symbol}`, err);
      toast.error("Unable to update leverage. Try again.");
    },
  });

  const confirm = () => {
    mutation.mutate({ symbol, isCross, leverage });
  };

  return {
    isPending: mutation.isPending,
    confirm,
    isConnectWalletOpen,
    closeConnectWallet,
  };
}
