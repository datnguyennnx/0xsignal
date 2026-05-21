import { useState } from "react";
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
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/core/utils/cn";

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
  assetIndex,
  currentLeverage,
  symbol = "this asset",
  onConfirm,
}: MarginModeModalProps) {
  const [mode, setMode] = useState<"cross" | "isolated">(currentMode);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => api.updateLeverage(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
      onConfirm?.(mode);
      onOpenChange(false);
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setMode(currentMode);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    mutation.mutate({ asset: assetIndex, isCross: mode === "cross", leverage: currentLeverage });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border/30 p-5 gap-[clamp(0.5rem,1vw,1rem)] overflow-hidden">
        {/* ─── Header ─── */}
        <div className="p-0">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-foreground">Margin Mode</DialogTitle>
          </DialogHeader>
        </div>

        {/* ─── Body ─── */}
        <div className="space-y-3">
          {/* Isolated block — first, with Recommended */}
          <button
            onClick={() => setMode("isolated")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all",
              mode === "isolated"
                ? "border-foreground bg-foreground/5"
                : "border-border/30 bg-transparent hover:border-border"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)]">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      mode === "isolated" ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    Isolated
                  </span>
                  <span
                    className={cn(
                      "text-[0.6rem] px-1.5 py-0.5 rounded",
                      mode === "isolated"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground bg-muted/30"
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

          {/* Cross block — second, no tag */}
          <button
            onClick={() => setMode("cross")}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all",
              mode === "cross"
                ? "border-foreground bg-foreground/5"
                : "border-border/30 bg-transparent hover:border-border"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <span
                  className={cn(
                    "text-sm font-medium",
                    mode === "cross" ? "text-foreground" : "text-muted-foreground"
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

          {/* Summary row */}
          <div className="flex items-center justify-between px-3 py-2 bg-background/70 rounded-md border border-border/20">
            <span className="text-xs text-muted-foreground">Leverage for {symbol}</span>
            <span className="text-sm font-mono tabular-nums text-foreground">
              {currentLeverage}x
            </span>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <DialogFooter className="p-0">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg border-0 bg-foreground text-background hover:bg-foreground/90"
          >
            {mutation.isPending ? "Confirming..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
