import { useState, useCallback } from "react";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { useOpenOrders } from "../hooks/use-user-data";
import { useUserBalances, useWhaleBalances } from "../hooks/use-user-balances";
import { TabTrigger } from "./shared-table-components";
import { useIsSigningDisabled } from "@/hooks/use-effective-address";
import { PositionManagementPanels } from "./position-management-panels";
import { PositionManagementModals, type TpSlOrder } from "./position-management-modals";
import { usePositionActions } from "../hooks/use-position-actions";
import {
  useWhaleClearinghouseState,
  useWhaleOpenOrders,
} from "@/features/portfolio/hooks/use-portfolio-data";

const PANEL_SURFACE =
  "rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface gap-[var(--space-4,1.5rem)]";

const ROOT_CLASS = {
  fill: `h-full min-h-0 flex flex-col overflow-y-auto ${PANEL_SURFACE}`,
  flow: `flex flex-col ${PANEL_SURFACE}`,
};

const TABS_SURFACE = "flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]";

const TABS_CLASS = {
  fill: `flex-1 min-h-0 ${TABS_SURFACE}`,
  flow: TABS_SURFACE,
};

export function PositionManagement({
  readOnlyAddress,
  variant = "fill",
}: {
  readOnlyAddress?: string | undefined;
  variant?: "fill" | "flow";
}) {
  const readOnly = readOnlyAddress !== undefined;
  const signingDisabled = useIsSigningDisabled() || readOnly;
  const whaleState = useWhaleClearinghouseState(readOnlyAddress);
  const ownBalances = useUserBalances(!readOnly);
  const whaleBalances = useWhaleBalances(readOnlyAddress);
  const {
    balanceCount,
    positionsCount: ownPositionsCount,
    isChLoading: isOwnChLoading,
    positions: ownPositions,
  } = readOnly ? whaleBalances : ownBalances;
  const positions = readOnly ? (whaleState.data?.assetPositions ?? []) : ownPositions;
  const positionsCount = readOnly ? positions.length : ownPositionsCount;
  const isChLoading = readOnly ? whaleState.isLoading : isOwnChLoading;
  const ownOpenOrders = useOpenOrders(!readOnly);
  const whaleOpenOrders = useWhaleOpenOrders(readOnlyAddress);
  const { data: openOrders, isLoading: isOoLoading } = readOnly ? whaleOpenOrders : ownOpenOrders;
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

  const [tpSlModalOrder, setTpSlModalOrder] = useState<TpSlOrder | null>(null);

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
    <div className={ROOT_CLASS[variant]}>
      {signingDisabled && (
        <p className="w-fit mb-2 shrink-0 rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          Viewing another account — connect a wallet to trade.
        </p>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className={TABS_CLASS[variant]}>
        <TabsList className="shrink-0 flex gap-[clamp(0.5rem,0.8vw,0.75rem)]">
          <TabTrigger value="balances" count={isChLoading ? undefined : balanceCount}>
            Balances
          </TabTrigger>
          <TabTrigger value="positions" count={isChLoading ? undefined : positionsCount}>
            Positions
          </TabTrigger>
          <TabTrigger value="open-orders" count={isOoLoading ? undefined : openOrdersCount}>
            Open Orders
          </TabTrigger>
          <TabTrigger value="twap">TWAP</TabTrigger>
          <TabTrigger value="trade-history">Trade History</TabTrigger>
          <TabTrigger value="funding-history">Funding History</TabTrigger>
          <TabTrigger value="order-history">Order History</TabTrigger>
        </TabsList>

        {/* one scroll edge per view — Apple HIG scroll views */}
        <div className="scroll-edge" aria-hidden="true" />

        <PositionManagementPanels
          signingDisabled={signingDisabled}
          positions={positions}
          isChLoading={isChLoading}
          readOnly={readOnly}
          readOnlyAddress={readOnlyAddress}
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
