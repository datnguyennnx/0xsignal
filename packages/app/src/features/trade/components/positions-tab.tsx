import { useMemo } from "react";
import { useCoinContextPanel } from "@/components/app-side-panel";
import { useMarketDataStore } from "@/stores/use-market-data-store";
import { useOpenOrders } from "../hooks/use-user-data";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useHyperliquidWs } from "../hooks/use-hyperliquid-ws";
import { buildFundingRatesMap } from "../utils/trade-math";
import { buildTpSlByCoinMap } from "../utils/trigger-utils";
import { reportAllMidsError } from "../hooks/use-all-mids";
import { PositionsTable, type PositionRow } from "./positions-table";

const ALL_MIDS_SUBSCRIPTION = { channel: "allMids" as const } as const;

interface PositionsTabProps {
  positions: PositionRow[];
  isChLoading: boolean;
  readOnly: boolean;
  onCloseMarket: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit: (pos: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
}

/**
 * Wrapper for the Positions tab content. The caller owns the position source,
 * so the same table serves the own account and a read-only third party.
 */
export function PositionsTab({
  positions,
  isChLoading,
  readOnly,
  onCloseMarket,
  onCloseLimit,
}: PositionsTabProps) {
  // A third party's table never reads mids, so it must not subscribe to them.
  const mids = useMarketDataStore((state) => (readOnly ? undefined : state.allMids));
  const allMidsSubscription = useMemo(() => (readOnly ? null : ALL_MIDS_SUBSCRIPTION), [readOnly]);
  useHyperliquidWs({
    subscription: allMidsSubscription,
    enabled: !readOnly,
    onError: reportAllMidsError,
  });
  const { meta } = useHyperliquidMeta();
  const { data: openOrders } = useOpenOrders(!readOnly);
  const { openCoin } = useCoinContextPanel();

  const fundingRates = useMemo(() => buildFundingRatesMap(meta), [meta]);
  const tpSlByCoin = useMemo(() => buildTpSlByCoinMap(openOrders), [openOrders]);

  return (
    <PositionsTable
      isChLoading={isChLoading}
      positions={positions}
      mids={mids}
      fundingRates={fundingRates}
      tpSlByCoin={tpSlByCoin}
      onCloseMarket={onCloseMarket}
      onCloseLimit={onCloseLimit}
      onSelectCoin={readOnly ? openCoin : undefined}
      readOnly={readOnly}
    />
  );
}
