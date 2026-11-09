import { useCallback, useMemo } from "react";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { useUserFills } from "@/features/trade/hooks/use-user-data";
import {
  intervalToSeconds,
  mapFillsToLogicalMarkers,
  markerFillWindow,
  selectMarkerFillsInWindow,
  type HyperliquidFill,
  type LogicalTradeMarker,
} from "@/features/trade/utils/trade-markers";
import { mapToHLInterval } from "@/core/utils/hyperliquid";
import { CHART_CANDLE_LIMIT } from "@/features/trade/lib/candle-limit";

interface UseChartFeedParams {
  symbol: string;
  interval: string;
  /** False when the caller draws someone else's markers: the viewer's fills only get discarded. */
  fillsEnabled?: boolean;
}

const EMPTY_FILLS: readonly HyperliquidFill[] = [];

export function useChartFeed({ symbol, interval, fillsEnabled = true }: UseChartFeedParams) {
  const {
    data: candles,
    isLoading: candlesLoading,
    error: candleError,
    loadMore: loadMoreCandles,
    retry: retryCandles,
    hasMore: hasMoreCandles,
  } = useHyperliquidCandles({
    symbol,
    interval: mapToHLInterval(interval),
    limit: CHART_CANDLE_LIMIT,
  });

  const handleLoadMore = useCallback(async () => {
    await loadMoreCandles();
  }, [loadMoreCandles]);

  // Trade markers: HTML overlay (B/S circles)
  const { data: rawFills } = useUserFills(fillsEnabled);
  const timeframeSec = useMemo(() => intervalToSeconds(interval), [interval]);
  // Only the window bounds matter to selection; a candle tick inside the same
  // window must not re-filter or re-sort the fills.
  const fillWindow = markerFillWindow(candles, timeframeSec);
  const fillWindowStartMs = fillWindow?.startMs ?? null;
  const fillWindowEndMs = fillWindow?.endMs ?? null;
  const fills = useMemo<readonly HyperliquidFill[]>(() => {
    if (!rawFills) return EMPTY_FILLS;

    const mapped: HyperliquidFill[] = [];
    for (let i = 0; i < rawFills.length; i++) {
      const fill = rawFills[i];
      if (typeof fill.dir !== "string") continue;
      mapped.push({
        coin: fill.coin,
        px: fill.px,
        sz: fill.sz,
        side: fill.side,
        time: fill.time,
        dir: fill.dir,
        hash: fill.hash,
        tid: fill.tid,
      });
    }
    // The mapper sorts and copies everything it receives, so drop fills the
    // chart cannot show and cap the rest before handing them over.
    return selectMarkerFillsInWindow(
      mapped,
      fillWindowStartMs === null || fillWindowEndMs === null
        ? null
        : { startMs: fillWindowStartMs, endMs: fillWindowEndMs },
    );
  }, [rawFills, fillWindowStartMs, fillWindowEndMs]);

  const markers = useMemo<LogicalTradeMarker[]>(
    () => mapFillsToLogicalMarkers(fills, timeframeSec, symbol),
    [fills, timeframeSec, symbol],
  );

  return {
    candles,
    isLoading: candlesLoading,
    hasMoreCandles,
    handleLoadMore,
    retryCandles,
    markers,
    candleError,
  };
}
