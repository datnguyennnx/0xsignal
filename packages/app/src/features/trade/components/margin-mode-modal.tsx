import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  assetIndex,
  currentLeverage,
  symbol = "this asset",
  onConfirm,
}: MarginModeModalProps) {
  const [mode, setMode] = useState<"cross" | "isolated">(currentMode);
  const { isPending, confirm, isConnectWalletOpen, closeConnectWallet } = useMarginModeMutation({
    symbol,
    assetIndex,
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
      <DialogContent layout="dialog" className="gap-stack">
        <DialogHeader>
          <DialogTitle>Margin Mode</DialogTitle>
          <DialogDescription>Choose how margin is shared across your positions.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-section-tight overflow-y-auto">
          <MarginModeOptions mode={mode} onModeChange={setMode} />

          <div className="flex items-center justify-between px-3 py-2 tier-well rounded-control border border-border/25">
            <span className="type-data text-muted-foreground">Leverage for {symbol}</span>
            <span className="type-data tabular-nums text-foreground">{currentLeverage}x</span>
          </div>
        </div>

        <Button variant="cta" onClick={confirm} disabled={isPending} className="w-full">
          {isPending ? `Setting ${mode}...` : mode === "isolated" ? "Set isolated" : "Set cross"}
        </Button>
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
