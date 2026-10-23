import { useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAdjustLeverageMutation } from "../hooks/use-adjust-leverage-mutation";
import { AdjustLeveragePanel } from "./adjust-leverage-panel";

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
  const { isPending, confirm, isConnectWalletOpen, closeConnectWallet } = useAdjustLeverageMutation(
    {
      symbol,
      isCross,
      leverage,
      onConfirm,
      onOpenChange,
    },
  );

  // Adjust state during render when the modal is reopened for another asset.
  const [prevCurrentLeverage, setPrevCurrentLeverage] = useState(currentLeverage);
  if (prevCurrentLeverage !== currentLeverage) {
    setPrevCurrentLeverage(currentLeverage);
    setLeverage(currentLeverage);
  }

  const isDecreasingLeverage = hasPosition && leverage < currentLeverage;

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleSliderCommit = (value: number | readonly number[]) => {
    setLeverage(typeof value === "number" ? value : (value[0] ?? 1));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= maxLeverage) {
      setLeverage(val);
    }
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

        <AdjustLeveragePanel
          leverage={leverage}
          currentLeverage={currentLeverage}
          maxLeverage={maxLeverage}
          isCross={isCross}
          isDecreasingLeverage={isDecreasingLeverage}
          onSliderCommit={handleSliderCommit}
          onInputChange={handleInputChange}
        />

        <div className="pt-1">
          <Button
            variant="default"
            onClick={confirm}
            disabled={isPending}
            className="h-10 w-full rounded-lg text-[length:var(--text-compact)] font-semibold transition-[background-color,transform] duration-150 ease-premium active:scale-[0.98]"
          >
            {isPending ? `Setting ${leverage}×...` : `Set ${leverage}× leverage`}
          </Button>
        </div>
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
