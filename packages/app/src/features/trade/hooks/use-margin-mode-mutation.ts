import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type UpdateLeverageRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { UnauthenticatedError } from "@/lib/api-base";
import { useAppStore } from "@/stores/use-app-store";

interface UseMarginModeMutationParams {
  symbol: string;
  leverage: number;
  mode: "cross" | "isolated";
  onConfirm?: ((newMode: "cross" | "isolated") => void) | undefined;
  onOpenChange: (open: boolean) => void;
}

export function useMarginModeMutation({
  symbol,
  leverage,
  mode,
  onConfirm,
  onOpenChange,
}: UseMarginModeMutationParams) {
  const queryClient = useQueryClient();
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["trade-margin-mode"] ?? false);
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("trade-margin-mode");
  }, []);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("trade-margin-mode");
  }, []);

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => api.updateLeverage(params),
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
      console.error("Failed to update margin mode", err);
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
