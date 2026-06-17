import { useMemo } from "react";
import { useOpenOrders } from "../hooks/use-user-data";
import { useUserBalances } from "../hooks/use-user-balances";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useAllMids } from "../hooks/use-all-mids";
import { buildFundingRatesMap } from "../utils/trade-math";
import { buildTpSlByCoinMap } from "../utils/trigger-utils";
import { PositionsTable } from "./positions-table";

interface PositionsTabProps {
  onCloseMarket: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit: (pos: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
}

/**
 * Wrapper for the Positions tab content.
 * Internally calls useUserBalances(), useAllMids(), useHyperliquidMeta(),
 * and computes fundingRates / tpSlByCoin from local data.
 */
export function PositionsTab({ onCloseMarket, onCloseLimit }: PositionsTabProps) {
  const { isChLoading, positions } = useUserBalances();
  const mids = useAllMids();
  const { meta } = useHyperliquidMeta();
  const { data: openOrders } = useOpenOrders();

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
    />
  );
}
