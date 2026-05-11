import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, type PlaceOrderRequest } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import type { FrontendOpenOrderSchema } from "@/services/api";
import {
  useClearinghouseState,
  useSpotClearinghouseState,
  useOpenOrders,
  useUserFills,
  useHistoricalOrders,
  useCancelOrdersMutation,
} from "../hooks/use-user-positions";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useAllMids } from "../hooks/use-all-mids";
import { TabTrigger } from "./shared-table-utils";
import { BalanceTable } from "./balance-table";
import { PositionsTable } from "./positions-table";
import { OpenOrdersTable } from "./open-orders-table";
import { TradeHistoryTable, HistoryOrderTable } from "./order-history-table";
import { TpSlViewModal, toTpSlDisplay } from "./tp-sl-view-modal";
import { CloseLimitModal } from "./close-limit-modal";
import { formatOrderSize } from "../utils/trade-math";

export function PositionManagement() {
  const { data: chData, isLoading: chLoading } = useClearinghouseState();
  const { data: spotData } = useSpotClearinghouseState();
  const { data: openOrders, isLoading: ooLoading } = useOpenOrders();
  const { data: fills, isLoading: fillsLoading } = useUserFills();
  const { data: histOrders, isLoading: histLoading } = useHistoricalOrders();
  const cancelOrdersMutation = useCancelOrdersMutation();

  /* ─── Place order mutation ─── */
  const queryClient = useQueryClient();
  const { meta: metaData, getPrecision } = useHyperliquidMeta();

  /* ─── Real-time mid prices from WebSocket ─── */
  const mids = useAllMids();

  const placeOrderMutation = useMutation({
    mutationFn: (params: PlaceOrderRequest) => api.placeOrder(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.openOrders() });
    },
  });

  /* ─── Active tab state ─── */
  const [activeTab, setActiveTab] = useState("balance");

  /* ─── Limit close modal state ─── */
  const [closeLimitPosition, setCloseLimitPosition] = useState<{
    coin: string;
    sz: number;
    isLong: boolean;
    markPx: number;
  } | null>(null);

  /* ─── TP/SL modal state ─── */
  const [tpSlModalOrder, setTpSlModalOrder] = useState<FrontendOpenOrderSchema | null>(null);

  /* ─── TP/SL modal computed display values ─── */
  const tpSlModalProps = useMemo(() => {
    if (!tpSlModalOrder) return null;
    const kids = tpSlModalOrder.children;
    return {
      parentDisplay: toTpSlDisplay(tpSlModalOrder),
      tpDisplay: kids?.[0] ? toTpSlDisplay(kids[0]) : undefined,
      slDisplay: kids?.[1] ? toTpSlDisplay(kids[1]) : undefined,
    };
  }, [tpSlModalOrder]);

  const positions = chData?.assetPositions ?? [];
  const marginSummary = chData?.marginSummary;
  const withdrawable = chData?.withdrawable;

  /* ─── Spot USDC balance ─── */
  const spotUsdc = spotData?.balances?.find((b) => b.coin === "USDC");
  const spotUsdcTotal = spotUsdc ? Number(spotUsdc.total) : null;
  const spotUsdcHold = spotUsdc ? Number(spotUsdc.hold) : null;

  const usdcTotalBalance =
    spotUsdcTotal !== null ? spotUsdcTotal : Number(marginSummary?.totalRawUsd ?? 0);
  const usdcAvailableBalance =
    spotUsdcTotal !== null && spotUsdcHold !== null
      ? spotUsdcTotal - spotUsdcHold
      : Number(withdrawable ?? usdcTotalBalance);

  /* ─── Effective values for Account row (perps-aware, falls back to Spot) ─── */
  const accountValue = marginSummary ? Number(marginSummary.accountValue) : 0;
  const effectiveAccountTotal = accountValue > 0 ? accountValue : usdcTotalBalance;
  const perpsWithdrawable = Number(withdrawable ?? 0);
  const effectiveAvailableBalance = accountValue > 0 ? perpsWithdrawable : usdcAvailableBalance;

  /* ─── Counts for tab badges ─── */
  const balanceCount = marginSummary ? 2 + positions.length : 0;
  const positionsCount = positions.length;
  const openOrdersCount = openOrders?.length ?? 0;

  /* ─── Aggregate PnL ─── */
  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + Number(p.position.unrealizedPnl),
    0
  );

  /* ─── Cancel confirmation dialog state ─── */
  const [cancelAllDialogOpen, setCancelAllDialogOpen] = useState(false);

  /* ─── Cancel order helpers ─── */
  const handleCancelOrder = (coin: string, oid: number) => {
    cancelOrdersMutation.mutate({ cancels: [{ coin, o: oid }] });
  };

  const handleCancelAllConfirm = () => {
    if (!openOrders || openOrders.length === 0) return;
    const cancels = openOrders.map((o) => ({ coin: o.coin, o: o.oid }));
    cancelOrdersMutation.mutate({ cancels });
    setCancelAllDialogOpen(false);
  };

  /* ─── Market close handler ─── */
  const handleCloseMarket = useCallback(
    (coin: string, size: string, isLong: boolean) => {
      const meta = metaData?.universe ?? [];
      const idx = meta.findIndex((a) => a.name === coin);
      const assetIndex = idx >= 0 ? idx : 0;
      const { szDecimals } = getPrecision(coin);
      const absSz = Math.abs(Number(size));
      const formattedSz = formatOrderSize(absSz, szDecimals);
      placeOrderMutation.mutate({
        orders: [
          {
            a: assetIndex,
            b: !isLong,
            p: "0",
            s: formattedSz,
            r: true,
            t: { limit: { tif: "FrontendMarket" as const } },
          },
        ],
        grouping: "na",
      });
    },
    [metaData, getPrecision, placeOrderMutation]
  );

  /* ─── Limit close handler ─── */
  const handleCloseLimitConfirm = useCallback(
    ({ price, size }: { price: string; size: string }) => {
      if (!closeLimitPosition) return;
      const { coin, isLong } = closeLimitPosition;
      const meta = metaData?.universe ?? [];
      const idx = meta.findIndex((a) => a.name === coin);
      const assetIndex = idx >= 0 ? idx : 0;
      placeOrderMutation.mutate({
        orders: [
          {
            a: assetIndex,
            b: !isLong,
            p: price,
            s: size,
            r: true,
            t: { limit: { tif: "Gtc" as const } },
          },
        ],
        grouping: "na",
      });
      setCloseLimitPosition(null);
    },
    [closeLimitPosition, metaData, placeOrderMutation]
  );

  /* ─── Close limit modal computed values ─── */
  const closeLimitSzDecimals = closeLimitPosition
    ? getPrecision(closeLimitPosition.coin).szDecimals
    : 4;

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="h-full flex flex-col overflow-hidden"
      >
        <TabsList className="shrink-0 flex gap-0 h-auto bg-transparent border-b border-border/40 rounded-none p-0">
          <TabTrigger value="balance" count={!chLoading ? balanceCount : undefined}>
            Balance
          </TabTrigger>
          <TabTrigger value="positions" count={!chLoading ? positionsCount : undefined}>
            Positions
          </TabTrigger>
          <TabTrigger value="open-orders" count={!ooLoading ? openOrdersCount : undefined}>
            Open Orders
          </TabTrigger>
          <TabTrigger value="trade-history">Trade History</TabTrigger>
          <TabTrigger value="order-history">Order History</TabTrigger>
        </TabsList>

        <TabsContent
          value="balance"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <BalanceTable
            chLoading={chLoading}
            marginSummary={marginSummary}
            positions={positions}
            usdcTotalBalance={usdcTotalBalance}
            usdcAvailableBalance={usdcAvailableBalance}
            totalUnrealizedPnl={totalUnrealizedPnl}
            effectiveAccountTotal={effectiveAccountTotal}
            effectiveAvailableBalance={effectiveAvailableBalance}
          />
        </TabsContent>

        <TabsContent
          value="positions"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <PositionsTable
            chLoading={chLoading}
            positions={positions}
            mids={mids}
            onCloseMarket={handleCloseMarket}
            onCloseLimit={(pos) => setCloseLimitPosition(pos)}
            onViewTpSl={() => setActiveTab("open-orders")}
          />
        </TabsContent>

        <TabsContent
          value="open-orders"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <OpenOrdersTable
            ooLoading={ooLoading}
            openOrders={openOrders}
            onCancelOrder={handleCancelOrder}
            onViewTpSl={(order) => setTpSlModalOrder(order)}
            onCancelAll={() => setCancelAllDialogOpen(true)}
            isCancelPending={cancelOrdersMutation.isPending}
            orderCount={openOrdersCount}
          />
        </TabsContent>

        <TabsContent
          value="trade-history"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <TradeHistoryTable fills={fills} fillsLoading={fillsLoading} />
        </TabsContent>

        <TabsContent
          value="order-history"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <HistoryOrderTable histOrders={histOrders} histLoading={histLoading} />
        </TabsContent>
      </Tabs>

      {/* ─── TP/SL View Modal ─── */}
      {tpSlModalProps && (
        <TpSlViewModal
          open={tpSlModalOrder != null}
          onOpenChange={(open) => {
            if (!open) setTpSlModalOrder(null);
          }}
          parentOrder={tpSlModalProps.parentDisplay}
          tpOrder={tpSlModalProps.tpDisplay}
          slOrder={tpSlModalProps.slDisplay}
        />
      )}

      {/* ─── Cancel All Confirmation Dialog ─── */}
      <Dialog open={cancelAllDialogOpen} onOpenChange={setCancelAllDialogOpen}>
        <DialogContent className="sm:max-w-[360px] bg-card border-border/30 p-0 gap-0 overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border/20">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium text-foreground">
                Cancel All Orders
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
              Are you sure you want to cancel all {openOrders?.length ?? 0} open order
              {openOrders?.length !== 1 ? "s" : ""}?
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3">
            <DialogClose asChild>
              <Button variant="outline" className="h-8 px-3 text-xs font-medium">
                Keep Orders
              </Button>
            </DialogClose>
            <Button
              onClick={handleCancelAllConfirm}
              className="h-8 px-3 text-xs font-medium bg-foreground text-background hover:bg-foreground/90"
            >
              Cancel All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Close Limit Modal ─── */}
      <CloseLimitModal
        isOpen={closeLimitPosition != null}
        onClose={() => setCloseLimitPosition(null)}
        position={closeLimitPosition}
        szDecimals={closeLimitSzDecimals}
        onConfirmLimitClose={handleCloseLimitConfirm}
        isPending={placeOrderMutation.isPending}
      />
    </>
  );
}
