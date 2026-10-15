import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { api, type UpdateLeverageRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "cn";
import { AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import { UnauthenticatedError } from "@/lib/api-base";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAppStore } from "@/stores/use-app-store";

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
  isCross,
  symbol = "this asset",
  hasPosition = false,
  onConfirm,
}: AdjustLeverageModalProps) {
  const [leverage, setLeverage] = useState(currentLeverage);
  const queryClient = useQueryClient();
  const isConnectWalletOpen = useAppStore(
    (s) => s.connectWalletOpen["trade-adjust-leverage"] ?? false,
  );
  const openConnectWallet = useCallback(
    () => useAppStore.getState().openConnectWallet("trade-adjust-leverage"),
    [],
  );
  const closeConnectWallet = useCallback(
    () => useAppStore.getState().closeConnectWallet("trade-adjust-leverage"),
    [],
  );

  // Sync state when prop changes (e.g. modal opened for a different asset)
  useEffect(() => {
    setLeverage(currentLeverage);
  }, [currentLeverage]);

  const isDecreasingLeverage = hasPosition && leverage < currentLeverage;

  const ticks = [
    1,
    Math.round(maxLeverage * 0.25),
    Math.round(maxLeverage * 0.5),
    Math.round(maxLeverage * 0.75),
    Math.round(maxLeverage * 0.9),
    maxLeverage,
  ];

  const mutation = useMutation({
    mutationFn: (params: UpdateLeverageRequest) => api.updateLeverage(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
      onConfirm?.(leverage);
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
        return;
      }
      console.error("Failed to update leverage", err);
      toast.error("Unable to update leverage. Try again.");
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleSliderCommit = (value: number | readonly number[]) => {
    setLeverage((Array.isArray(value) ? value : [value])[0] ?? 1);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= maxLeverage) {
      setLeverage(val);
    }
  };

  const handleConfirm = () => {
    mutation.mutate({ symbol, isCross, leverage });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          MODAL_CONTENT_CLASS,
          "sm:max-w-[clamp(22rem,42vw,30rem)] p-5 gap-[clamp(0.5rem,1vw,1rem)]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[length:var(--text-compact)] font-medium text-foreground">
            Adjust Leverage
          </DialogTitle>
          <DialogDescription className="text-[length:var(--text-compact)] leading-relaxed">
            Control the leverage used for{" "}
            <span className="text-foreground font-medium">{symbol}</span> positions. Maximum
            leverage is {maxLeverage}x.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border/20 bg-muted/40 px-3 py-2">
            <span className="text-[length:var(--text-compact)] text-muted-foreground">Current</span>
            <span className="text-[length:var(--text-compact)] tabular-nums text-foreground">
              {currentLeverage}x — {isCross ? "Cross" : "Isolated"}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border/20 bg-muted/40 px-3 py-2">
              <Label
                htmlFor="adjust-leverage-input"
                className="text-[length:var(--text-compact)] font-normal text-muted-foreground"
              >
                Leverage
              </Label>
              <div className="flex items-baseline">
                <Input
                  id="adjust-leverage-input"
                  type="number"
                  min={1}
                  max={maxLeverage}
                  value={leverage}
                  onChange={handleInputChange}
                  className="h-7 w-14 border-0 bg-transparent p-0 text-right text-lg font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-lg font-semibold tabular-nums text-foreground">x</span>
              </div>
            </div>

            <Slider
              value={[leverage]}
              onValueChange={handleSliderCommit}
              min={1}
              max={maxLeverage}
              step={1}
              className="transition-opacity duration-200"
            />

            <div className="relative h-4 text-[length:var(--text-data)] text-muted-foreground">
              {ticks.map((tick, i) => {
                const isFirst = i === 0;
                const isLast = i === ticks.length - 1;
                const pct = maxLeverage > 1 ? ((tick - 1) / (maxLeverage - 1)) * 100 : 0;
                return (
                  <span
                    key={i}
                    className={cn(
                      "absolute tabular-nums",
                      isFirst && "left-0",
                      isLast && "right-0",
                      !isFirst && !isLast && "-translate-x-1/2",
                    )}
                    style={!isFirst && !isLast ? { left: `${pct}%` } : undefined}
                  >
                    {tick}x
                  </span>
                );
              })}
            </div>
          </div>

          <p className="text-[length:var(--text-data)] text-muted-foreground leading-relaxed">
            Max position size decreases the higher your leverage.
          </p>

          <Alert variant="destructive" className="px-3 py-2.5">
            <AlertTriangleIcon />
            <AlertDescription className="text-[length:var(--text-data)] leading-relaxed">
              {isDecreasingLeverage
                ? "Decreasing leverage requires additional margin. Ensure you have sufficient available balance."
                : "Note that setting a higher leverage increases the risk of liquidation."}
            </AlertDescription>
          </Alert>
        </div>

        <div className="pt-1">
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="h-10 w-full rounded-lg text-[length:var(--text-compact)] font-semibold transition-[background-color,transform] duration-150 ease-premium active:scale-[0.98]"
          >
            {mutation.isPending ? `Setting ${leverage}×...` : `Set ${leverage}× leverage`}
          </Button>
        </div>
        {isConnectWalletOpen && (
          <ConnectWalletDialog open={true} onOpenChange={(open) => !open && closeConnectWallet()} />
        )}
      </DialogContent>
    </Dialog>
  );
}
