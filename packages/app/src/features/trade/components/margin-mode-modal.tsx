import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, type UpdateLeverageRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/core/utils/cn";
import { UnauthenticatedError } from "@/lib/api-base";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAppStore } from "@/stores/use-app-store";

interface MarginModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: "cross" | "isolated";
  assetIndex: number;
  currentLeverage: number;
  symbol?: string;
  onConfirm?: (newMode: "cross" | "isolated") => void;
}

const MODE_CONFIG = {
  isolated: {
    title: "Isolated",
    description:
      "Isolated margin is used for isolated positions. Your position's margin is not shared with other positions. You can manage your isolated positions by adjusting the isolated margin.",
  },
  cross: {
    title: "Cross",
    description:
      "All cross positions share the same cross margin. The cross margin is used to prevent liquidation. If a position is liquidated, the cross margin is distributed among your other cross positions.",
  },
} as const;

export function MarginModeModal({
  open,
  onOpenChange,
  currentMode,
  currentLeverage,
  symbol = "this asset",
  onConfirm,
}: MarginModeModalProps) {
  const [mode, setMode] = useState<"cross" | "isolated">(currentMode);
  const queryClient = useQueryClient();
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["trade-margin-mode"] ?? false);
  const openConnectWallet = useCallback(
    () => useAppStore.getState().openConnectWallet("trade-margin-mode"),
    [],
  );
  const closeConnectWallet = useCallback(
    () => useAppStore.getState().closeConnectWallet("trade-margin-mode"),
    [],
  );

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => api.updateLeverage(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
      onConfirm?.(mode);
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
      }
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setMode(currentMode);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    mutation.mutate({ symbol, isCross: mode === "cross", leverage: currentLeverage });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border/30 p-5 gap-[clamp(0.5rem,1vw,1rem)] overflow-hidden">
        <div className="p-0">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-foreground">Margin Mode</DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMode("isolated")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all active:brightness-90",
              mode === "isolated"
                ? "border-foreground bg-foreground/5"
                : "border-border/30 bg-transparent hover:border-border",
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)]">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      mode === "isolated" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    Isolated
                  </span>
                  <span
                    className={cn(
                      "text-[0.6rem] px-1.5 py-0.5 rounded",
                      mode === "isolated"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground bg-muted/30",
                    )}
                  >
                    Recommended
                  </span>
                </div>
                <p className="text-[0.65rem] text-muted-foreground leading-relaxed max-w-sm">
                  {MODE_CONFIG.isolated.description}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("cross")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all active:brightness-90",
              mode === "cross"
                ? "border-foreground bg-foreground/5"
                : "border-border/30 bg-transparent hover:border-border",
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <span
                  className={cn(
                    "text-sm font-medium",
                    mode === "cross" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  Cross
                </span>
                <p className="text-[0.65rem] text-muted-foreground leading-relaxed max-w-sm">
                  {MODE_CONFIG.cross.description}
                </p>
              </div>
            </div>
          </button>

          <div className="flex items-center justify-between px-3 py-2 bg-background/70 rounded-md border border-border/20">
            <span className="text-xs text-muted-foreground">Leverage for {symbol}</span>
            <span className="text-sm tabular-nums text-foreground">{currentLeverage}x</span>
          </div>
        </div>

        <DialogFooter className="p-0">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg border-0 transition-all duration-150 ease-premium bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
          >
            {mutation.isPending ? "Confirming..." : "Confirm"}
          </Button>
        </DialogFooter>
        {isConnectWalletOpen && (
          <ConnectWalletDialog open={true} onOpenChange={(open) => !open && closeConnectWallet()} />
        )}
      </DialogContent>
    </Dialog>
  );
}
