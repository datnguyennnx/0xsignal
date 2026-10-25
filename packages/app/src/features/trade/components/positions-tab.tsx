import { useMemo } from "react";
import { useOpenOrders } from "../hooks/use-user-data";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useAllMids } from "../hooks/use-all-mids";
import { buildFundingRatesMap } from "../utils/trade-math";
import { buildTpSlByCoinMap } from "../utils/trigger-utils";
import { PositionsTable, type PositionRow } from "./positions-table";

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
  const mids = useAllMids();
  const { meta } = useHyperliquidMeta();
  const { data: openOrders } = useOpenOrders(!readOnly);

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
      readOnly={readOnly}
    />
  );
}
