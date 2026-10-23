import { TabsContent } from "@/components/ui/tabs";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import { FundingHistoryTable } from "./funding-history-table";
import { OutcomesTable } from "./outcomes-table";
import { BalancesTab, OrderHistoryTab, TradeHistoryTab } from "./position-tabs";
import { PositionsTab } from "./positions-tab";
import { OpenOrdersTab } from "./open-orders-tab";
import { TwapContent } from "./twap-content";

interface PositionManagementPanelsProps {
  signingDisabled: boolean;
  onCloseMarket: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit: (position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
  onCancelAll: () => void;
  isCancelPending: boolean;
}

export function PositionManagementPanels({
  signingDisabled,
  onCloseMarket,
  onCloseLimit,
  onCancelOrder,
  onViewTpSl,
  onCancelAll,
  isCancelPending,
}: PositionManagementPanelsProps) {
  return (
    <>
      <TabsContent
        value="balances"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <BalancesTab />
      </TabsContent>

      <TabsContent
        value="positions"
        className={`flex-1 min-h-0 data-active:flex data-active:flex-col${
          signingDisabled ? " pointer-events-none opacity-60" : ""
        }`}
        title={signingDisabled ? "Connect a wallet to trade" : undefined}
      >
        <PositionsTab
          onCloseMarket={onCloseMarket}
          onCloseLimit={(pos) => {
            onCloseLimit(pos);
          }}
        />
      </TabsContent>

      <TabsContent
        value="outcomes"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <OutcomesTable />
      </TabsContent>

      <TabsContent
        value="open-orders"
        className={`flex-1 min-h-0 data-active:flex data-active:flex-col${
          signingDisabled ? " pointer-events-none opacity-60" : ""
        }`}
        title={signingDisabled ? "Connect a wallet to trade" : undefined}
      >
        <OpenOrdersTab
          onCancelOrder={onCancelOrder}
          onViewTpSl={(order) => {
            onViewTpSl(order);
          }}
          onCancelAll={() => {
            onCancelAll();
          }}
          isCancelPending={isCancelPending}
        />
      </TabsContent>

      <TabsContent value="twap" className="flex-1 min-h-0 data-active:flex data-active:flex-col">
        <TwapContent />
      </TabsContent>

      <TabsContent
        value="trade-history"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <TradeHistoryTab />
      </TabsContent>

      <TabsContent
        value="funding-history"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <FundingHistoryTable />
      </TabsContent>

      <TabsContent
        value="order-history"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <OrderHistoryTab />
      </TabsContent>
    </>
  );
}
