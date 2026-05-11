import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { api, type UpdateLeverageRequest } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/core/utils/cn";
import { AlertTriangleIcon } from "lucide-react";

interface AdjustLeverageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLeverage: number;
  maxLeverage: number;
  assetIndex: number;
  isCross: boolean;
  symbol?: string;
  hasPosition?: boolean;
  onConfirm?: (newLeverage: number) => void;
}

export function AdjustLeverageModal({
  open,
  onOpenChange,
  currentLeverage,
  maxLeverage,
  assetIndex,
  isCross,
  symbol = "this asset",
  hasPosition = false,
  onConfirm,
}: AdjustLeverageModalProps) {
  const [leverage, setLeverage] = useState(currentLeverage);
  const queryClient = useQueryClient();

  // Reset internal state to fresh chain-derived values whenever dialog opens
  // (Radix Dialog keeps content mounted, so useState doesn't reinitialize on reopen)
  useEffect(() => {
    if (open) {
      setLeverage(currentLeverage);
    }
  }, [open]);

  const isDecreasingLeverage = hasPosition && leverage < currentLeverage;

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => api.updateLeverage(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
      onConfirm?.(leverage);
      onOpenChange(false);
    },
  });

  const handleSliderCommit = (values: number[]) => {
    setLeverage(values[0] ?? 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= maxLeverage) {
      setLeverage(val);
    }
  };

  const handleConfirm = () => {
    mutation.mutate({ asset: assetIndex, isCross, leverage });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border/30 p-0 gap-0 overflow-hidden">
        {/* ─── Header ─── */}
        <div className="px-5 pt-4 pb-2 border-b border-border/20">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-foreground">
              Adjust Leverage
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* ─── Body ─── */}
        <div className="px-5 py-4 space-y-4">
          {/* Descriptive text */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Control the leverage used for{" "}
            <span className="text-foreground font-medium">{symbol}</span> positions. The maximum
            leverage is {maxLeverage}x.
          </p>

          {/* Current state */}
          <div className="flex items-center justify-between px-3 py-2 bg-background/70 rounded-md border border-border/20">
            <span className="text-xs text-muted-foreground">Current</span>
            <span className="text-sm font-mono tabular-nums text-foreground">
              {currentLeverage}x — {isCross ? "Cross" : "Isolated"}
            </span>
          </div>

          {/* Leverage control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-normal">Leverage</Label>
              <span className="text-lg font-mono tabular-nums font-semibold text-foreground">
                {leverage}x
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Slider
                value={[leverage]}
                onValueChange={handleSliderCommit}
                min={1}
                max={maxLeverage}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                max={maxLeverage}
                value={leverage}
                onChange={handleInputChange}
                className="w-14 h-8 text-xs text-center tabular-nums bg-background/70 border-border/30"
              />
            </div>

            <div className="flex justify-between text-[0.55rem] text-muted-foreground/60">
              <span>1x</span>
              <span>{Math.round(maxLeverage * 0.25)}x</span>
              <span>{Math.round(maxLeverage * 0.5)}x</span>
              <span>{Math.round(maxLeverage * 0.75)}x</span>
              <span>{Math.round(maxLeverage * 0.9)}x</span>
              <span>{maxLeverage}x</span>
            </div>
          </div>

          {/* Max position info */}
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Max position size decreases the higher your leverage.
          </p>

          {/* Warning box: context-aware */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-loss-muted/20 border border-loss/20">
            <AlertTriangleIcon className="size-3.5 text-warn shrink-0 mt-0.5" />
            <p className="text-[0.65rem] text-muted-foreground leading-relaxed">
              {isDecreasingLeverage
                ? "Decreasing leverage requires additional margin. Ensure you have sufficient available balance."
                : "Note that setting a higher leverage increases the risk of liquidation."}
            </p>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <DialogFooter className="px-5 py-3 border-t border-border/20">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className={cn(
              "w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg border-0",
              "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            {mutation.isPending ? "Confirming..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
