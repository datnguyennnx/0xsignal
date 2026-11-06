import { type ReactNode } from "react";
import { TabsContent } from "@/components/ui/tabs";
import type { FrontendOpenOrder } from "@0xsignal/shared";
import { FundingHistoryTable } from "./funding-history-table";
import { BalancesTab, OrderHistoryTab, TradeHistoryTab } from "./position-tabs";
import { PositionsTab } from "./positions-tab";
import type { PositionRow } from "./positions-table";
import { OpenOrdersTab } from "./open-orders-tab";
import { TabTrigger } from "./shared-table-components";
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

interface PositionTabCounts {
  balances: number | undefined;
  positions: number | undefined;
  openOrders: number | undefined;
}

interface PositionTabDefinition {
  value: string;
  label: string;
  render: (props: PositionManagementPanelsProps) => ReactNode;
  count?: (counts: PositionTabCounts) => number | undefined;
  dimWhenSigningDisabled?: boolean;
}

/** Single list for both the tab strip and the panels, so neither can drift. */
const POSITION_TABS: PositionTabDefinition[] = [
  {
    value: "balances",
    label: "Balances",
    render: ({ readOnlyAddress }) => <BalancesTab readOnlyAddress={readOnlyAddress} />,
    count: (counts) => counts.balances,
  },
  {
    value: "positions",
    label: "Positions",
    render: ({ positions, isChLoading, readOnly, onCloseMarket, onCloseLimit }) => (
      <PositionsTab
        positions={positions}
        isChLoading={isChLoading}
        readOnly={readOnly}
        onCloseMarket={onCloseMarket}
        onCloseLimit={onCloseLimit}
      />
    ),
    count: (counts) => counts.positions,
    dimWhenSigningDisabled: true,
  },
  {
    value: "open-orders",
    label: "Open Orders",
    render: ({ readOnlyAddress, onCancelOrder, onViewTpSl, onCancelAll, isCancelPending }) => (
      <OpenOrdersTab
        readOnlyAddress={readOnlyAddress}
        onCancelOrder={onCancelOrder}
        onViewTpSl={onViewTpSl}
        onCancelAll={onCancelAll}
        isCancelPending={isCancelPending}
      />
    ),
    count: (counts) => counts.openOrders,
    dimWhenSigningDisabled: true,
  },
  {
    value: "twap",
    label: "TWAP",
    render: ({ readOnly }) => <TwapContent readOnly={readOnly} />,
  },
  {
    value: "trade-history",
    label: "Trade History",
    render: ({ readOnlyAddress }) => <TradeHistoryTab readOnlyAddress={readOnlyAddress} />,
  },
  {
    value: "funding-history",
    label: "Funding History",
    render: ({ readOnlyAddress }) => <FundingHistoryTable readOnlyAddress={readOnlyAddress} />,
  },
  {
    value: "order-history",
    label: "Order History",
    render: ({ readOnlyAddress }) => <OrderHistoryTab readOnlyAddress={readOnlyAddress} />,
  },
];

export function PositionTabTriggers({ counts }: { counts: PositionTabCounts }) {
  return (
    <>
      {POSITION_TABS.map((tab) => (
        <TabTrigger key={tab.value} value={tab.value} count={tab.count?.(counts)}>
          {tab.label}
        </TabTrigger>
      ))}
    </>
  );
}

export function PositionManagementPanels(props: PositionManagementPanelsProps) {
  const { signingDisabled, readOnly } = props;
  return (
    <>
      {POSITION_TABS.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={`flex-1 min-h-0 data-active:flex data-active:flex-col${
            tab.dimWhenSigningDisabled === true && signingDisabled && !readOnly ? " opacity-60" : ""
          }`}
        >
          {tab.render(props)}
        </TabsContent>
      ))}
    </>
  );
}
