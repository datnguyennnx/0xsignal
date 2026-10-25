import { useCallback } from "react";
import { LeverageMarginBar } from "./leverage-margin-bar";
import { AdjustLeverageModal } from "./adjust-leverage-modal";
import { MarginModeModal } from "./margin-mode-modal";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAppStore } from "@/stores/use-app-store";

interface OrderFormLeverageProps {
  signingDisabled?: boolean;
  effectiveMarginMode: "cross" | "isolated";
  effectiveLeverage: number;
  onMarginModeOpenChange: (open: boolean) => void;
  onAdjustLeverageOpenChange: (open: boolean) => void;
  adjustLeverageOpen: boolean;
  marginModeOpen: boolean;
  currentLeverage: number;
  currentMarginMode: "cross" | "isolated";
  maxLeverage: number;
  assetIndex: number;
  symbol: string;
  hasPosition: boolean;
  onConfirmLeverage: (leverage: number) => void;
  onConfirmMarginMode: (mode: "cross" | "isolated") => void;
}

export function OrderFormLeverage({
  signingDisabled = false,
  effectiveMarginMode,
  effectiveLeverage,
  onMarginModeOpenChange,
  onAdjustLeverageOpenChange,
  adjustLeverageOpen,
  marginModeOpen,
  currentLeverage,
  currentMarginMode,
  maxLeverage,
  assetIndex,
  symbol,
  hasPosition,
  onConfirmLeverage,
  onConfirmMarginMode,
}: OrderFormLeverageProps) {
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["trade-order-form"] ?? false);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("trade-order-form");
  }, []);

  return (
    <>
      <LeverageMarginBar
        disabled={signingDisabled}
        effectiveMarginMode={effectiveMarginMode}
        effectiveLeverage={effectiveLeverage}
        onOpenMarginMode={() => {
          onMarginModeOpenChange(true);
        }}
        onOpenLeverage={() => {
          onAdjustLeverageOpenChange(true);
        }}
      />

      {/* Modals use chain-derived values, not local state, for initial props */}
      <AdjustLeverageModal
        open={adjustLeverageOpen}
        onOpenChange={onAdjustLeverageOpenChange}
        currentLeverage={currentLeverage}
        maxLeverage={maxLeverage}
        assetIndex={assetIndex}
        isCross={currentMarginMode === "cross"}
        symbol={symbol}
        hasPosition={hasPosition}
        onConfirm={(newLev) => {
          onConfirmLeverage(newLev);
        }}
      />
      <MarginModeModal
        open={marginModeOpen}
        onOpenChange={onMarginModeOpenChange}
        currentMode={currentMarginMode}
        assetIndex={assetIndex}
        currentLeverage={currentLeverage}
        symbol={symbol}
        onConfirm={(newMode) => {
          onConfirmMarginMode(newMode);
        }}
      />
      {isConnectWalletOpen && (
        <ConnectWalletDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) closeConnectWallet();
          }}
        />
      )}
    </>
  );
}
