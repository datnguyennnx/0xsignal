import { useMemo } from "react";
import {
  mapFillsToLogicalMarkers,
  type HyperliquidFill,
  type LogicalTradeMarker,
} from "@/features/trade/utils/trade-markers";

interface UseTradeMarkersOptions {
  fills: readonly HyperliquidFill[];
  timeframeSec: number;
  currentCoin: string;
  /** Reserved for future marker-candle alignment validation. */
  candles?: readonly unknown[];
}

interface UseTradeMarkersResult {
  markers: LogicalTradeMarker[];
}

export function useTradeMarkers({
  fills,
  timeframeSec,
  currentCoin,
}: UseTradeMarkersOptions): UseTradeMarkersResult {
  const markers = useMemo<LogicalTradeMarker[]>(
    () => mapFillsToLogicalMarkers(fills, timeframeSec, currentCoin),
    [fills, timeframeSec, currentCoin],
  );

  return { markers };
}
