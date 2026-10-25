import { useCallback, useMemo } from "react";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import { TpSlViewModal } from "./tp-sl-view-modal";
import { CancelAllDialog } from "./cancel-all-dialog";
import { CloseLimitModal } from "./close-limit-modal";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { toTpSlDisplay } from "../utils/tp-sl-view-utils";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useAppStore } from "@/stores/use-app-store";

export type TpSlOrder = FrontendOpenOrder;

interface CloseLimitPosition {
  coin: string;
  sz: number;
  isLong: boolean;
  markPx: number;
}

interface PositionManagementModalsProps {
  tpSlOrder: FrontendOpenOrder | null;
  onCloseTpSl: () => void;
  cancelAllOpen: boolean;
  onCancelAllOpenChange: (open: boolean) => void;
  orderCount: number;
  onCancelAllConfirm: () => void;
  isCancelPending: boolean;
  closeLimitPosition: CloseLimitPosition | null;
  onCloseCloseLimit: () => void;
  onConfirmLimitClose: (values: { price: string; size: string }) => void;
  isPlacePending: boolean;
}

export function PositionManagementModals({
  tpSlOrder,
  onCloseTpSl,
  cancelAllOpen,
  onCancelAllOpenChange,
  orderCount,
  onCancelAllConfirm,
  isCancelPending,
  closeLimitPosition,
  onCloseCloseLimit,
  onConfirmLimitClose,
  isPlacePending,
}: PositionManagementModalsProps) {
  const { getPrecision } = useHyperliquidMeta();
  const isConnectWalletOpen = useAppStore(
    (s) => s.connectWalletOpen["trade-position-management"] ?? false,
  );
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("trade-position-management");
  }, []);

  const tpSlModalProps = useMemo(() => {
    if (!tpSlOrder) return null;
    const kids = tpSlOrder.children;
    const tpKid = kids?.[0];
    const slKid = kids?.[1];
    return {
      parentDisplay: toTpSlDisplay(tpSlOrder),
      tpDisplay: tpKid === undefined ? undefined : toTpSlDisplay(tpKid),
      slDisplay: slKid === undefined ? undefined : toTpSlDisplay(slKid),
    };
  }, [tpSlOrder]);

  const closeLimitSzDecimals = closeLimitPosition
    ? getPrecision(closeLimitPosition.coin).szDecimals
    : 4;

  return (
    <>
      {tpSlModalProps && (
        <TpSlViewModal
          open={tpSlOrder != null}
          onOpenChange={(open) => {
            if (!open) onCloseTpSl();
          }}
          parentOrder={tpSlModalProps.parentDisplay}
          tpOrder={tpSlModalProps.tpDisplay}
          slOrder={tpSlModalProps.slDisplay}
        />
      )}

      <CancelAllDialog
        open={cancelAllOpen}
        onOpenChange={onCancelAllOpenChange}
        orderCount={orderCount}
        onConfirm={onCancelAllConfirm}
        isPending={isCancelPending}
      />

      <CloseLimitModal
        isOpen={closeLimitPosition != null}
        onClose={onCloseCloseLimit}
        position={closeLimitPosition}
        szDecimals={closeLimitSzDecimals}
        onConfirmLimitClose={onConfirmLimitClose}
        isPending={isPlacePending}
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
