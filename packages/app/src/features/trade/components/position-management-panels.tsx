import { TabsContent } from "@/components/ui/tabs";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import { FundingHistoryTable } from "./funding-history-table";
import { BalancesTab, OrderHistoryTab, TradeHistoryTab } from "./position-tabs";
import { PositionsTab } from "./positions-tab";
import type { PositionRow } from "./positions-table";
import { OpenOrdersTab } from "./open-orders-tab";
import { TwapContent } from "./twap-content";

interface PositionManagementPanelsProps {
  signingDisabled: boolean;
  positions: PositionRow[];
  isChLoading: boolean;
  readOnly: boolean;
  readOnlyAddress?: string | undefined;
  onCloseMarket: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit: (position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
  onCancelAll: () => void;
  isCancelPending: boolean;
}

export function PositionManagementPanels({
  signingDisabled,
  positions,
  isChLoading,
  readOnly,
  readOnlyAddress,
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
        <BalancesTab readOnlyAddress={readOnlyAddress} />
      </TabsContent>

      <TabsContent
        value="positions"
        className={`flex-1 min-h-0 data-active:flex data-active:flex-col${
          signingDisabled && !readOnly ? " opacity-60" : ""
        }`}
      >
        <PositionsTab
          positions={positions}
          isChLoading={isChLoading}
          readOnly={readOnly}
          onCloseMarket={onCloseMarket}
          onCloseLimit={(pos) => {
            onCloseLimit(pos);
          }}
        />
      </TabsContent>

      <TabsContent
        value="open-orders"
        className={`flex-1 min-h-0 data-active:flex data-active:flex-col${
          signingDisabled && !readOnly ? " opacity-60" : ""
        }`}
      >
        <OpenOrdersTab
          readOnlyAddress={readOnlyAddress}
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
        <TwapContent readOnly={readOnly} />
      </TabsContent>

      <TabsContent
        value="trade-history"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <TradeHistoryTab readOnlyAddress={readOnlyAddress} />
      </TabsContent>

      <TabsContent
        value="funding-history"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <FundingHistoryTable readOnlyAddress={readOnlyAddress} />
      </TabsContent>

      <TabsContent
        value="order-history"
        className="flex-1 min-h-0 data-active:flex data-active:flex-col"
      >
        <OrderHistoryTab readOnlyAddress={readOnlyAddress} />
      </TabsContent>
    </>
  );
}
