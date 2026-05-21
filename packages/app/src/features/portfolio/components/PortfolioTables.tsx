/**
 * Portfolio Tables — tabs for Balances, Positions, Open Orders,
 * Funding History, Trade History, and Order History.
 */
import { useState } from "react";
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs";
import { TabTrigger } from "@/features/trade/components/shared-table-components";
import { BalanceTable } from "@/features/trade/components/balance-table";
import { PositionsTable } from "@/features/trade/components/positions-table";
import { OpenOrdersTable } from "@/features/trade/components/open-orders-table";
import {
  TradeHistoryTable,
  HistoryOrderTable,
} from "@/features/trade/components/order-history-table";
import { FundingHistoryTable } from "@/features/trade/components/funding-history-table";
import {
  useOpenOrders,
  useUserFills,
  useHistoricalOrders,
} from "@/features/trade/hooks/use-user-data";
import { useUserBalances } from "@/features/trade/hooks/use-user-balances";

/* ─── Main Component ─── */

export function PortfolioTables() {
  const [activeTab, setActiveTab] = useState("balance");

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

  const openOrdersCount = openOrders?.length ?? 0;

  return (
    <div className="h-full flex flex-col rounded-xl border border-border/20 p-4 bg-card animate-in fade-in duration-200 ease-premium gap-[clamp(0.5rem,1vw,1rem)]">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col overflow-hidden gap-[clamp(0.25rem,0.5vw,0.5rem)]"
      >
        <TabsList className="shrink-0 flex gap-[clamp(0.25rem,0.5vw,0.5rem)] h-auto bg-transparent rounded-none p-0">
          <TabTrigger value="balance" count={!isChLoading ? balanceCount : undefined}>
            Balances
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
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
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
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <PositionsTable isChLoading={isChLoading} positions={positions} mids={{}} />
        </TabsContent>

        <TabsContent
          value="open-orders"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <OpenOrdersTable
            isOoLoading={isOoLoading}
            openOrders={openOrders}
            onCancelOrder={() => {}}
            onViewTpSl={() => {}}
            onCancelAll={() => {}}
            isCancelPending={false}
            orderCount={openOrdersCount}
          />
        </TabsContent>

        <TabsContent
          value="funding-history"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <FundingHistoryTable />
        </TabsContent>

        <TabsContent
          value="trade-history"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <TradeHistoryTable fills={fills} isFillsLoading={isFillsLoading} />
        </TabsContent>

        <TabsContent
          value="order-history"
          className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
        >
          <HistoryOrderTable histOrders={histOrders} isHistLoading={isHistLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
