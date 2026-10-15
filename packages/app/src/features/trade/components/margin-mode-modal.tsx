import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, type UpdateLeverageRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { SELECTED_CARD_CLASS } from "@/lib/state-classes";
import { cn } from "cn";
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
        return;
      }
      console.error("Failed to update margin mode", err);
      toast.error("Unable to update margin mode. Try again.");
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
      <DialogContent
        className={cn(
          MODAL_CONTENT_CLASS,
          "sm:max-w-[clamp(24rem,46vw,32.5rem)] p-5 gap-[clamp(0.5rem,1vw,1rem)]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-foreground">Margin Mode</DialogTitle>
          <DialogDescription className="text-[length:var(--text-compact)]">
            Choose how margin is shared across your positions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            onClick={() => setMode("isolated")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-[background-color,border-color,filter] active:brightness-95",
              mode === "isolated"
                ? SELECTED_CARD_CLASS
                : "border-border/40 bg-transparent hover:border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      mode === "isolated" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    Isolated
                  </span>
                  <span className="text-[length:var(--text-data)] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Recommended
                  </span>
                </div>
                <p className="text-[length:var(--text-compact)] text-muted-foreground leading-relaxed max-w-sm">
                  {MODE_CONFIG.isolated.description}
                </p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  mode === "isolated" ? "border-foreground" : "border-border/60",
                )}
              >
                {mode === "isolated" && <span className="size-2 rounded-full bg-foreground" />}
              </span>
            </div>
          </button>

          <button
            onClick={() => setMode("cross")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-[background-color,border-color,filter] active:brightness-95",
              mode === "cross"
                ? SELECTED_CARD_CLASS
                : "border-border/40 bg-transparent hover:border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    mode === "cross" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  Cross
                </span>
                <p className="text-[length:var(--text-compact)] text-muted-foreground leading-relaxed max-w-sm">
                  {MODE_CONFIG.cross.description}
                </p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  mode === "cross" ? "border-foreground" : "border-border/60",
                )}
              >
                {mode === "cross" && <span className="size-2 rounded-full bg-foreground" />}
              </span>
            </div>
          </button>

          <div className="flex items-center justify-between px-3 py-2 bg-background/70 rounded-md border border-border/20">
            <span className="text-[length:var(--text-data)] text-muted-foreground">
              Leverage for {symbol}
            </span>
            <span className="text-sm tabular-nums text-foreground">{currentLeverage}x</span>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 p-0 border-t-0 bg-transparent rounded-none sm:flex-col">
          <Button
            size="sm"
            variant="default"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="w-full h-10 text-[length:var(--text-data)] font-semibold uppercase tracking-wider rounded-lg border-0 transition-[background-color,transform] duration-150 ease-premium active:scale-[0.98]"
          >
            {mutation.isPending
              ? `Setting ${mode}...`
              : mode === "isolated"
                ? "Set isolated"
                : "Set cross"}
          </Button>
        </DialogFooter>
        {isConnectWalletOpen && (
          <ConnectWalletDialog open={true} onOpenChange={(open) => !open && closeConnectWallet()} />
        )}
      </DialogContent>
    </Dialog>
  );
}
