import { useCallback, useMemo } from "react";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { useUserFills } from "@/features/trade/hooks/use-user-data";
import { useTradeMarkers } from "./use-trade-markers";
import { intervalToSeconds, type HyperliquidFill } from "@/features/trade/utils/trade-markers";
import { mapToHLInterval } from "@/core/utils/hyperliquid";

interface UseChartFeedParams {
  symbol: string;
  interval: string;
}

const EMPTY_FILLS: readonly HyperliquidFill[] = [];

export function useChartFeed({ symbol, interval }: UseChartFeedParams) {
  const {
    data: candles,
    loadMore: loadMoreCandles,
    hasMore: hasMoreCandles,
  } = useHyperliquidCandles({ symbol, interval: mapToHLInterval(interval), limit: 250 });

  const handleLoadMore = useCallback(async () => {
    await loadMoreCandles();
  }, [loadMoreCandles]);

  // Trade markers: HTML overlay (B/S circles)
  const { data: rawFills } = useUserFills();
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
    return mapped;
  }, [rawFills]);

  const timeframeSec = useMemo(() => intervalToSeconds(interval), [interval]);

  const { markers } = useTradeMarkers({
    fills,
    timeframeSec,
    currentCoin: symbol,
  });

  return { candles, hasMoreCandles, handleLoadMore, markers };
}
