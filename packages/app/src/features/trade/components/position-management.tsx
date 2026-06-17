import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import { useOpenOrders, useCancelOrdersMutation } from "../hooks/use-user-data";
import { useUserBalances } from "../hooks/use-user-balances";
import { usePlaceOrder } from "../hooks/use-place-order";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { FundingHistoryTable } from "./funding-history-table";
import { OutcomesTable } from "./outcomes-table";
import { TabTrigger } from "./shared-table-components";
import { TpSlViewModal } from "./tp-sl-view-modal";
import { toTpSlDisplay } from "../utils/tp-sl-view-utils";
import { CloseLimitModal } from "./close-limit-modal";
import { CancelAllDialog } from "./cancel-all-dialog";
import { BalancesTab } from "./balances-tab";
import { PositionsTab } from "./positions-tab";
import { OpenOrdersTab } from "./open-orders-tab";
import { TradeHistoryTab } from "./trade-history-tab";
import { OrderHistoryTab } from "./order-history-tab";
import { TwapContent } from "./twap-content";
import { formatOrderSize } from "../utils/trade-math";
import { UnauthenticatedError } from "@/lib/api-base";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAppStore } from "@/stores/use-app-store";

export function PositionManagement() {
  const isConnectWalletOpen = useAppStore(
    (s) => s.connectWalletOpen["trade-position-management"] ?? false,
  );
  const openConnectWallet = useCallback(
    () => useAppStore.getState().openConnectWallet("trade-position-management"),
    [],
  );
  const closeConnectWallet = useCallback(
    () => useAppStore.getState().closeConnectWallet("trade-position-management"),
    [],
  );
  const { balanceCount, positionsCount, isChLoading } = useUserBalances();
  const { data: openOrders, isLoading: isOoLoading } = useOpenOrders();
  const cancelOrdersMutation = useCancelOrdersMutation();
  const { getPrecision } = useHyperliquidMeta();

  const handlePlaceOrderError = useCallback(
    (err: Error) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
      }
    },
    [openConnectWallet],
  );
  const placeOrderMutation = usePlaceOrder(handlePlaceOrderError);

  const [activeTab, setActiveTab] = useState("balances");

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
      cancelOrdersMutation.mutate(
        { cancels: [{ symbol: coin, orderId: oid }] },
        {
          onError: (err) => {
            if (err instanceof UnauthenticatedError) {
              openConnectWallet();
            }
          },
        },
      );
    },
    [cancelOrdersMutation, openConnectWallet],
  );

  const handleCancelAllConfirm = () => {
    if (!openOrders || openOrders.length === 0) return;
    const cancels = openOrders.map((o) => ({ symbol: o.coin, orderId: o.oid }));
    cancelOrdersMutation.mutate(
      { cancels },
      {
        onError: (err) => {
          if (err instanceof UnauthenticatedError) {
            openConnectWallet();
          }
        },
      },
    );
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
    [getPrecision, placeOrderMutation],
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
    [closeLimitPosition, placeOrderMutation],
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
          <TabTrigger value="balances" count={!isChLoading ? balanceCount : undefined}>
            Balances
          </TabTrigger>
          <TabTrigger value="positions" count={!isChLoading ? positionsCount : undefined}>
            Positions
          </TabTrigger>
          <TabTrigger value="outcomes">Outcomes</TabTrigger>
          <TabTrigger value="open-orders" count={!isOoLoading ? openOrdersCount : undefined}>
            Open Orders
          </TabTrigger>
          <TabTrigger value="twap">TWAP</TabTrigger>
          <TabTrigger value="trade-history">Trade History</TabTrigger>
          <TabTrigger value="funding-history">Funding History</TabTrigger>
          <TabTrigger value="order-history">Order History</TabTrigger>
        </TabsList>

        <TabsContent
          value="balances"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <BalancesTab />
        </TabsContent>

        <TabsContent
          value="positions"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <PositionsTab
            onCloseMarket={handleCloseMarket}
            onCloseLimit={(pos) => setCloseLimitPosition(pos)}
          />
        </TabsContent>

        <TabsContent
          value="outcomes"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <OutcomesTable />
        </TabsContent>

        <TabsContent
          value="open-orders"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <OpenOrdersTab
            onCancelOrder={handleCancelOrder}
            onViewTpSl={(order) => setTpSlModalOrder(order)}
            onCancelAll={() => setCancelAllDialogOpen(true)}
            isCancelPending={cancelOrdersMutation.isPending}
          />
        </TabsContent>

        <TabsContent
          value="twap"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <TwapContent />
        </TabsContent>

        <TabsContent
          value="trade-history"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <TradeHistoryTab />
        </TabsContent>

        <TabsContent
          value="funding-history"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <FundingHistoryTable />
        </TabsContent>

        <TabsContent
          value="order-history"
          className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <OrderHistoryTab />
        </TabsContent>
      </Tabs>

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

      <CancelAllDialog
        open={cancelAllDialogOpen}
        onOpenChange={setCancelAllDialogOpen}
        orderCount={openOrdersCount}
        onConfirm={handleCancelAllConfirm}
        isPending={cancelOrdersMutation.isPending}
      />

      <CloseLimitModal
        isOpen={closeLimitPosition != null}
        onClose={() => setCloseLimitPosition(null)}
        position={closeLimitPosition}
        szDecimals={closeLimitSzDecimals}
        onConfirmLimitClose={handleCloseLimitConfirm}
        isPending={placeOrderMutation.isPending}
      />
      {isConnectWalletOpen && (
        <ConnectWalletDialog open={true} onOpenChange={(open) => !open && closeConnectWallet()} />
      )}
    </div>
  );
}
