import { useMemo } from "react";

import { useWhaleFills } from "@/features/portfolio/hooks/use-portfolio-data";
import {
  intervalToSeconds,
  mapFillsToLogicalMarkers,
  type HyperliquidFill,
  type LogicalTradeMarker,
} from "@/features/trade/utils/trade-markers";

const NO_MARKERS: readonly LogicalTradeMarker[] = [];

/**
 * The chart's marker layer defaults to the viewer's fills; on a whale chart that
 * feed belongs to someone else, so the subject's fills replace it outright
 * rather than mixing two accounts under one bubble column.
 */
export function useWhaleCoinMarkers(
  address: string | undefined,
  coin: string,
  interval: string,
): readonly LogicalTradeMarker[] {
  const { data: fills } = useWhaleFills(address);

  return useMemo(() => {
    if (fills === undefined) return NO_MARKERS;

    const coinKey = coin.toUpperCase();
    const mapped: HyperliquidFill[] = [];
    for (const fill of fills) {
      // A fill without `dir` cannot be classified as an open or a close.
      if (fill.dir === undefined) continue;
      if (fill.coin.toUpperCase() !== coinKey) continue;
      mapped.push({
        coin: coinKey,
        px: fill.px,
        sz: fill.sz,
        side: fill.side,
        time: fill.time,
        dir: fill.dir,
        hash: fill.hash,
        tid: fill.tid,
      });
    }

    if (mapped.length === 0) return NO_MARKERS;
    return mapFillsToLogicalMarkers(mapped, intervalToSeconds(interval), coinKey);
  }, [fills, coin, interval]);
}
