import { useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  assetIndex,
  isCross,
  symbol = "this asset",
  hasPosition = false,
  onConfirm,
}: AdjustLeverageModalProps) {
  const [leverage, setLeverage] = useState(currentLeverage);
  const { isPending, confirm, isConnectWalletOpen, closeConnectWallet } = useAdjustLeverageMutation(
    {
      symbol,
      assetIndex,
      isCross,
      leverage,
      onConfirm,
      onOpenChange,
    },
  );

  // Adjust state during render: the component stays mounted while closed, so the draft
  // must be reset on the open transition, not only when the asset's leverage changes.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setLeverage(currentLeverage);
  }

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
      <DialogContent layout="dialog" className="gap-stack">
        <DialogHeader>
          <DialogTitle>Adjust Leverage</DialogTitle>
          <DialogDescription>
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

        <Button variant="cta" onClick={confirm} disabled={isPending} className="w-full">
          {isPending ? `Setting ${leverage}×...` : `Set ${leverage}× leverage`}
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
