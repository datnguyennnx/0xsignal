import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import type { UpdateLeverageRequest } from "@/services/api";
import { submitUpdateLeverage } from "@/services/exchange";
import { queryKeys } from "@/lib/query-keys";
import { UnauthenticatedError } from "@/lib/api-base";
import { useAppStore } from "@/stores/use-app-store";

interface UseMarginModeMutationParams {
  symbol: string;
  assetIndex: number;
  leverage: number;
  mode: "cross" | "isolated";
  onConfirm?: ((newMode: "cross" | "isolated") => void) | undefined;
  onOpenChange: (open: boolean) => void;
}

export function useMarginModeMutation({
  symbol,
  assetIndex,
  leverage,
  mode,
  onConfirm,
  onOpenChange,
}: UseMarginModeMutationParams) {
  const queryClient = useQueryClient();
  const { address, chainId } = useConnection();
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["trade-margin-mode"] ?? false);
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("trade-margin-mode");
  }, []);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("trade-margin-mode");
  }, []);

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => {
      if (address === undefined) {
        throw new UnauthenticatedError("Connect a wallet to update margin mode");
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
      onConfirm?.(mode);
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
        return;
      }
      console.error(`Failed to update margin mode for ${symbol}`, err);
      toast.error("Unable to update margin mode. Try again.");
    },
  });

  const confirm = () => {
    mutation.mutate({ symbol, isCross: mode === "cross", leverage });
  };

  return {
    isPending: mutation.isPending,
    confirm,
    isConnectWalletOpen,
    closeConnectWallet,
  };
}
