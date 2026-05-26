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
import { Pagination } from "@/components/ui/pagination";
import { api, type PlaceOrderRequest } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import {
  useOpenOrders,
  useUserFills,
  useHistoricalOrders,
  useCancelOrdersMutation,
} from "../hooks/use-user-data";
import { useUserBalances } from "../hooks/use-user-balances";
import { FundingHistoryTable } from "./funding-history-table";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useAllMids } from "../hooks/use-all-mids";
import { usePagination } from "@/hooks/use-pagination";
import { TabTrigger } from "./shared-table-components";
import { BalanceTable } from "./balance-table";
import { PositionsTable } from "./positions-table";
import { OpenOrdersTable } from "./open-orders-table";
import { TradeHistoryTable, HistoryOrderTable } from "./order-history-table";
import { TpSlViewModal } from "./tp-sl-view-modal";
import { toTpSlDisplay } from "./tp-sl-view-utils";
import { CloseLimitModal } from "./close-limit-modal";
import { formatOrderSize } from "../utils/trade-math";
import { getOrderType } from "../utils/trigger-utils";
import { formatPrice } from "@/core/utils/formatters";

export function PositionManagement() {
  const {
    positions,
    marginSummary,
    usdcTotalBalance,
    usdcAvailableBalance,
    totalUnrealizedPnl,
    effectiveAccountTotal,
    effectiveAvailableBalance,
    balanceCount,
    positionsCount,
    isChLoading,
  } = useUserBalances();
  const { data: openOrders, isLoading: isOoLoading } = useOpenOrders();
  const { data: fills, isLoading: isFillsLoading } = useUserFills();
  const { data: histOrders, isLoading: isHistLoading } = useHistoricalOrders();
  const cancelOrdersMutation = useCancelOrdersMutation();

  const queryClient = useQueryClient();
  const { meta, getPrecision } = useHyperliquidMeta();

  const mids = useAllMids();

  const paginatedFills = usePagination(fills ?? [], 20);
  const paginatedHistOrders = usePagination(histOrders ?? [], 20);
  const paginatedOpenOrders = usePagination(openOrders ?? [], 20);

  const fundingRates = useMemo(() => {
    if (!meta) return {};
    const map: Record<string, number> = {};
    for (const market of meta) {
      if (market.marketType !== "perp") continue;
      const rate = Number(market.funding);
      if (Number.isFinite(rate) && rate !== 0) {
        map[market.coin.toUpperCase()] = rate;
      }
    }
    return map;
  }, [meta]);

  const tpSlByCoin = useMemo(() => {
    if (!openOrders) return {};
    const map: Record<string, { tp: string | null; sl: string | null }> = {};
    for (const order of openOrders) {
      if (!order.children?.length) continue;
      let tp: string | null = null;
      let sl: string | null = null;
      for (const child of order.children) {
        const ot = getOrderType(child);
        const limitVal = Number(child.limitPx);
        const triggerVal = Number(child.triggerPx);
        const priceNum = limitVal > 0 ? limitVal : triggerVal > 0 ? triggerVal : 0;
        const px = formatPrice(priceNum);
        if (ot.includes("Take Profit")) tp = px;
        else if (ot.includes("Stop")) sl = px;
      }
      if (tp || sl) {
        map[order.coin.toUpperCase()] = { tp, sl };
      }
    }
    return map;
  }, [openOrders]);

  const placeOrderMutation = useMutation({
    mutationFn: (params: PlaceOrderRequest) => api.placeOrder(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.openOrders() });
    },
  });

  const [activeTab, setActiveTab] = useState("balance");

  const [closeLimitPosition, setCloseLimitPosition] = useState<{
    coin: string;
    sz: number;
    isLong: boolean;
    markPx: number;
  } | null>(null);

  const [tpSlModalOrder, setTpSlModalOrder] = useState<FrontendOpenOrder | null>(null);

  const tpSlModalProps = useMemo(() => {
    if (!tpSlModalOrder) return null;
    const kids = tpSlModalOrder.children;
    return {
      parentDisplay: toTpSlDisplay(tpSlModalOrder),
      tpDisplay: kids?.[0] ? toTpSlDisplay(kids[0]) : undefined,
      slDisplay: kids?.[1] ? toTpSlDisplay(kids[1]) : undefined,
    };
  }, [tpSlModalOrder]);

  const openOrdersCount = openOrders?.length ?? 0;

  const [cancelAllDialogOpen, setCancelAllDialogOpen] = useState(false);

  const handleCancelOrder = useCallback(
    (coin: string, oid: number) => {
      cancelOrdersMutation.mutate({ cancels: [{ symbol: coin, orderId: oid }] });
    },
    [cancelOrdersMutation]
  );

  const handleCancelAllConfirm = () => {
    if (!openOrders || openOrders.length === 0) return;
    const cancels = openOrders.map((o) => ({ symbol: o.coin, orderId: o.oid }));
    cancelOrdersMutation.mutate({ cancels });
    setCancelAllDialogOpen(false);
  };

  const handleCloseMarket = useCallback(
    (coin: string, size: string, isLong: boolean) => {
      const { szDecimals } = getPrecision(coin);
      const absSz = Math.abs(Number(size));
      const formattedSz = formatOrderSize(absSz, szDecimals);
      placeOrderMutation.mutate({
        orders: [
          {
            symbol: coin,
            side: isLong ? "sell" : "buy",
            quantity: formattedSz,
            price: "0",
            reduceOnly: true,
            orderType: { kind: "limit", timeInForce: "FrontendMarket" },
          },
        ],
        grouping: "na",
      });
    },
    [getPrecision, placeOrderMutation]
  );

  const handleCloseLimitConfirm = useCallback(
    ({ price, size }: { price: string; size: string }) => {
      if (!closeLimitPosition) return;
      const { coin, isLong } = closeLimitPosition;
      placeOrderMutation.mutate({
        orders: [
          {
            symbol: coin,
            side: isLong ? "sell" : "buy",
            quantity: size,
            price,
            reduceOnly: true,
            orderType: { kind: "limit", timeInForce: "GTC" },
          },
        ],
        grouping: "na",
      });
      setCloseLimitPosition(null);
    },
    [closeLimitPosition, placeOrderMutation]
  );

  const closeLimitSzDecimals = closeLimitPosition
    ? getPrecision(closeLimitPosition.coin).szDecimals
    : 4;

  return (
    <div className="rounded-xl border border-border/20 p-4 bg-card gap-4">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 flex flex-col overflow-hidden gap-[clamp(0.5rem,0.8vw,0.75rem)]"
      >
        <TabsList className="shrink-0 flex gap-[clamp(0.5rem,0.8vw,0.75rem)] h-auto bg-transparent rounded-none p-0">
          <TabTrigger value="balance" count={!isChLoading ? balanceCount : undefined}>
            Balance
          </TabTrigger>
          <TabTrigger value="positions" count={!isChLoading ? positionsCount : undefined}>
            Positions
          </TabTrigger>
          <TabTrigger value="open-orders" count={!isOoLoading ? openOrdersCount : undefined}>
            Open Orders
          </TabTrigger>
          <TabTrigger value="funding-history">Funding History</TabTrigger>
          <TabTrigger value="trade-history">Trade History</TabTrigger>
          <TabTrigger value="order-history">Order History</TabTrigger>
        </TabsList>

        <TabsContent
          value="balance"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <BalanceTable
            isChLoading={isChLoading}
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
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <PositionsTable
            isChLoading={isChLoading}
            positions={positions}
            mids={mids}
            fundingRates={fundingRates}
            tpSlByCoin={tpSlByCoin}
            onCloseMarket={handleCloseMarket}
            onCloseLimit={(pos) => setCloseLimitPosition(pos)}
          />
        </TabsContent>

        <TabsContent
          value="open-orders"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <OpenOrdersTable
            isOoLoading={isOoLoading}
            openOrders={paginatedOpenOrders.pageData}
            onCancelOrder={handleCancelOrder}
            onViewTpSl={(order) => setTpSlModalOrder(order)}
            onCancelAll={() => setCancelAllDialogOpen(true)}
            isCancelPending={cancelOrdersMutation.isPending}
            orderCount={openOrdersCount}
          />
          <Pagination
            currentPage={paginatedOpenOrders.currentPage}
            totalPages={paginatedOpenOrders.totalPages}
            totalItems={paginatedOpenOrders.totalItems}
            pageSize={paginatedOpenOrders.pageSize}
            onPageChange={paginatedOpenOrders.setPage}
            onPageSizeChange={paginatedOpenOrders.setPageSize}
          />
        </TabsContent>

        <TabsContent
          value="funding-history"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <FundingHistoryTable />
        </TabsContent>

        <TabsContent
          value="trade-history"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <TradeHistoryTable fills={paginatedFills.pageData} isFillsLoading={isFillsLoading} />
          <Pagination
            currentPage={paginatedFills.currentPage}
            totalPages={paginatedFills.totalPages}
            totalItems={paginatedFills.totalItems}
            pageSize={paginatedFills.pageSize}
            onPageChange={paginatedFills.setPage}
            onPageSizeChange={paginatedFills.setPageSize}
          />
        </TabsContent>

        <TabsContent
          value="order-history"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <HistoryOrderTable
            histOrders={paginatedHistOrders.pageData}
            isHistLoading={isHistLoading}
          />
          <Pagination
            currentPage={paginatedHistOrders.currentPage}
            totalPages={paginatedHistOrders.totalPages}
            totalItems={paginatedHistOrders.totalItems}
            pageSize={paginatedHistOrders.pageSize}
            onPageChange={paginatedHistOrders.setPage}
            onPageSizeChange={paginatedHistOrders.setPageSize}
          />
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
        <DialogContent className="sm:max-w-[360px] bg-card border-border/30 p-5 gap-[clamp(0.75rem,1.25vw,1.25rem)] overflow-hidden">
          <div className="p-0">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium text-foreground">
                Cancel All Orders
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Are you sure you want to cancel all {openOrders?.length ?? 0} open order
              {openOrders?.length !== 1 ? "s" : ""}?
            </p>
          </div>
          <div className="flex items-center justify-end gap-[clamp(0.5rem,0.8vw,0.75rem)] p-0">
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
    </div>
  );
}
