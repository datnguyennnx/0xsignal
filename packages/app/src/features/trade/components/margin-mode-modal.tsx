import { useState } from "react";
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
import { cn } from "cn";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useMarginModeMutation } from "../hooks/use-margin-mode-mutation";
import { MarginModeOptions } from "./margin-mode-options";

interface MarginModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: "cross" | "isolated";
  assetIndex: number;
  currentLeverage: number;
  symbol?: string;
  onConfirm?: (newMode: "cross" | "isolated") => void;
}

export function MarginModeModal({
  open,
  onOpenChange,
  currentMode,
  currentLeverage,
  symbol = "this asset",
  onConfirm,
}: MarginModeModalProps) {
  const [mode, setMode] = useState<"cross" | "isolated">(currentMode);
  const { isPending, confirm, isConnectWalletOpen, closeConnectWallet } = useMarginModeMutation({
    symbol,
    leverage: currentLeverage,
    mode,
    onConfirm,
    onOpenChange,
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setMode(currentMode);
    }
    onOpenChange(newOpen);
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
          <MarginModeOptions mode={mode} onModeChange={setMode} />

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
            onClick={confirm}
            disabled={isPending}
            className="w-full h-10 text-[length:var(--text-data)] font-semibold uppercase tracking-wider rounded-lg border-0 transition-[background-color,transform] duration-150 ease-premium active:scale-[0.98]"
          >
            {isPending ? `Setting ${mode}...` : mode === "isolated" ? "Set isolated" : "Set cross"}
          </Button>
        </DialogFooter>
        {isConnectWalletOpen && (
          <ConnectWalletDialog
            open={true}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) closeConnectWallet();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
