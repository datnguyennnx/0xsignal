import { useState, useCallback } from "react";
import { Tabs, TabsList } from "@/components/ui/tabs";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import { useOpenOrders } from "../hooks/use-user-data";
import { useUserBalances } from "../hooks/use-user-balances";
import { TabTrigger } from "./shared-table-components";
import { useIsSigningDisabled } from "@/hooks/use-effective-address";
import { PositionManagementPanels } from "./position-management-panels";
import { PositionManagementModals } from "./position-management-modals";
import { usePositionActions } from "../hooks/use-position-actions";

export function PositionManagement() {
  const signingDisabled = useIsSigningDisabled();
  const { balanceCount, positionsCount, isChLoading } = useUserBalances();
  const { data: openOrders, isLoading: isOoLoading } = useOpenOrders();
  const {
    handleCancelOrder,
    handleCancelAllConfirm,
    handleCloseMarket,
    submitCloseLimit,
    isCancelPending,
    isPlacePending,
  } = usePositionActions({ signingDisabled });

  const [activeTab, setActiveTab] = useState("balances");

  const [closeLimitPosition, setCloseLimitPosition] = useState<{
    coin: string;
    sz: number;
    isLong: boolean;
    markPx: number;
  } | null>(null);

  const [tpSlModalOrder, setTpSlModalOrder] = useState<FrontendOpenOrder | null>(null);

  const openOrdersCount = openOrders?.length ?? 0;

  const [cancelAllDialogOpen, setCancelAllDialogOpen] = useState(false);

  const handleCloseLimitConfirm = useCallback(
    ({ price, size }: { price: string; size: string }) => {
      if (!closeLimitPosition) return;
      const submitted = submitCloseLimit({
        coin: closeLimitPosition.coin,
        isLong: closeLimitPosition.isLong,
        price,
        size,
      });
      if (submitted) setCloseLimitPosition(null);
    },
    [closeLimitPosition, submitCloseLimit],
  );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-y-auto rounded-xl p-4 material-raised gap-4">
      {signingDisabled && (
        <p className="mb-2 shrink-0 rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          Viewing another account — connect a wallet to trade.
        </p>
      )}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]"
      >
        <TabsList className="shrink-0 flex gap-[clamp(0.5rem,0.8vw,0.75rem)]">
          <TabTrigger value="balances" count={isChLoading ? undefined : balanceCount}>
            Balances
          </TabTrigger>
          <TabTrigger value="positions" count={isChLoading ? undefined : positionsCount}>
            Positions
          </TabTrigger>
          <TabTrigger value="outcomes">Outcomes</TabTrigger>
          <TabTrigger value="open-orders" count={isOoLoading ? undefined : openOrdersCount}>
            Open Orders
          </TabTrigger>
          <TabTrigger value="twap">TWAP</TabTrigger>
          <TabTrigger value="trade-history">Trade History</TabTrigger>
          <TabTrigger value="funding-history">Funding History</TabTrigger>
          <TabTrigger value="order-history">Order History</TabTrigger>
        </TabsList>

        <PositionManagementPanels
          signingDisabled={signingDisabled}
          onCloseMarket={handleCloseMarket}
          onCloseLimit={setCloseLimitPosition}
          onCancelOrder={handleCancelOrder}
          onViewTpSl={setTpSlModalOrder}
          onCancelAll={() => {
            setCancelAllDialogOpen(true);
          }}
          isCancelPending={isCancelPending}
        />
      </Tabs>

      <PositionManagementModals
        tpSlOrder={tpSlModalOrder}
        onCloseTpSl={() => {
          setTpSlModalOrder(null);
        }}
        cancelAllOpen={cancelAllDialogOpen}
        onCancelAllOpenChange={setCancelAllDialogOpen}
        orderCount={openOrdersCount}
        onCancelAllConfirm={() => {
          if (handleCancelAllConfirm()) setCancelAllDialogOpen(false);
        }}
        isCancelPending={isCancelPending}
        closeLimitPosition={closeLimitPosition}
        onCloseCloseLimit={() => {
          setCloseLimitPosition(null);
        }}
        onConfirmLimitClose={handleCloseLimitConfirm}
        isPlacePending={isPlacePending}
      />
    </div>
  );
}
