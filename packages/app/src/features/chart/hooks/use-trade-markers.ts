import { useMemo, useEffect } from "react";
import {
  mapFillsToLogicalMarkers,
  type HyperliquidFill,
  type LogicalTradeMarker,
} from "@/features/trade/utils/trade-markers";

type CandleData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

interface UseTradeMarkersOptions {
  fills: readonly HyperliquidFill[];
  timeframeSec: number;
  currentCoin: string;
  candles?: readonly CandleData[];
}

interface UseTradeMarkersResult {
  markers: LogicalTradeMarker[];
}

export function useTradeMarkers({
  fills,
  timeframeSec,
  currentCoin,
  candles,
}: UseTradeMarkersOptions): UseTradeMarkersResult {
  const markers = useMemo<LogicalTradeMarker[]>(
    () => mapFillsToLogicalMarkers(fills, timeframeSec, currentCoin),
    [fills, timeframeSec, currentCoin]
  );

  // Dev validation: check every marker time exists in the candle set.
  useEffect(() => {
    if (!candles || candles.length === 0 || markers.length === 0) return;

    const candleTimes = new Set<number>();
    for (let i = 0; i < candles.length; i++) {
      candleTimes.add(candles[i].time);
    }

    let missingCount = 0;
    let sample: { markerTime: number; nearestCandleTime: number | null } | undefined;

    for (let i = 0; i < markers.length; i++) {
      const mTime = markers[i].time;
      if (candleTimes.has(mTime)) continue;

      missingCount++;
      if (!sample) {
        let nearest: number | null = null;
        let min = Infinity;
        for (let j = 0; j < candles.length; j++) {
          const d = Math.abs(candles[j].time - mTime);
          if (d < min) {
            min = d;
            nearest = candles[j].time;
          }
        }
        sample = { markerTime: mTime, nearestCandleTime: nearest };
      }
    }

    if (missingCount > 0) {
      console.warn(
        `[TradeMarkers] ${missingCount}/${markers.length} markers have no matching candle.`,
        `Sample: marker time ${sample?.markerTime}, nearest candle: ${sample?.nearestCandleTime}.`
      );
    }
  }, [markers, candles]);

  return { markers };
}
