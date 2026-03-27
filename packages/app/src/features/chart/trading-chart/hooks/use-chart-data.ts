/**
 * @overview Indicator Data Calculation Hook
 *
 * Transforms raw candlestick data into indicator time-series (Line, Band, Histogram).
 * Uses a ref-based caching layer to avoid recalculating indicators when only the last candle updates.
 *
 * @performance
 * - Cache stored in refs (not state) to avoid render-phase setState double-render loops.
 * - useMemo recomputes only when `activeIndicators` or `data` change.
 * - Cache keys encode data shape + last candle signature for fine-grained invalidation.
 * - react-hooks/refs is disabled because this hook intentionally uses refs as a cross-render
 *   memoization cache inside useMemo. Using useState would cause guaranteed double-renders on
 *   every tick, as the cache setState restarts the render with the cached value as a dependency.
 */
/* eslint-disable react-hooks/refs */
import { useMemo, useRef } from "react";
import type { ChartDataPoint, ActiveIndicator } from "@0xsignal/shared";
import { calculateLineIndicator, calculateBandIndicator, isBandIndicator } from "@0xsignal/shared";
import type {
  IndicatorDataMeta,
  IndicatorRenderEntry,
  IndicatorUpdateMode,
} from "./indicator-data.types";

const buildParamsKey = (params: Record<string, number>): string => {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}:${String(params[key])}`)
    .join("|");
};

const buildCacheKey = (
  indicatorId: string,
  paramsKey: string,
  dataLength: number,
  lastTime: number,
  firstTime: number,
  lastSignature: string
): string => {
  return `${indicatorId}#${paramsKey}#${dataLength}#${firstTime}#${lastTime}#${lastSignature}`;
};

const resolveUpdateMode = (
  previous: { firstTime: number; lastTime: number; dataLength: number } | null,
  current: { firstTime: number; lastTime: number; dataLength: number }
): IndicatorUpdateMode => {
  if (!previous) {
    return "setData";
  }

  if (
    current.dataLength === previous.dataLength + 1 &&
    current.lastTime > previous.lastTime &&
    current.firstTime === previous.firstTime
  ) {
    return "append";
  }

  if (
    current.dataLength === previous.dataLength &&
    current.lastTime === previous.lastTime &&
    current.firstTime === previous.firstTime
  ) {
    return "replaceLast";
  }

  return "setData";
};

interface CacheEntry {
  cacheKey: string;
  paramsKey: string;
  entry: IndicatorRenderEntry;
}

export const useIndicatorData = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]) => {
  // Refs instead of state — avoids render-phase setState that caused double-renders
  const indicatorCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const previousSourceRef = useRef<{
    firstTime: number;
    lastTime: number;
    dataLength: number;
  } | null>(null);

  const results = useMemo(() => {
    if (data.length === 0) {
      // Clear cache when data is empty (e.g. symbol change)
      indicatorCacheRef.current = new Map();
      previousSourceRef.current = null;
      return new Map<string, IndicatorRenderEntry>();
    }

    const firstTime = data[0].time;
    const lastTime = data[data.length - 1].time;
    const last = data[data.length - 1];
    const lastSignature = `${last.open}|${last.high}|${last.low}|${last.close}|${last.volume}`;
    const sourceState = { firstTime, lastTime, dataLength: data.length };
    const mode = resolveUpdateMode(previousSourceRef.current, sourceState);

    const newResults = new Map<string, IndicatorRenderEntry>();
    const cache = indicatorCacheRef.current;
    let cacheModified = false;
    const activeIds = new Set(activeIndicators.map((indicator) => indicator.instanceId));

    // Prune stale cache entries
    for (const [id] of cache.entries()) {
      if (!activeIds.has(id)) {
        cache.delete(id);
        cacheModified = true;
      }
    }

    for (const indicator of activeIndicators) {
      if (!indicator.visible) continue;

      const paramsKey = buildParamsKey(indicator.params);
      const cacheKey = buildCacheKey(
        indicator.instanceId,
        paramsKey,
        data.length,
        lastTime,
        firstTime,
        lastSignature
      );
      const cached = cache.get(indicator.instanceId);
      if (cached?.cacheKey === cacheKey) {
        newResults.set(indicator.instanceId, cached.entry);
        continue;
      }

      const forceSetData = cached && cached.paramsKey !== paramsKey;

      const meta: IndicatorDataMeta = {
        cacheKey,
        paramsKey,
        mode: forceSetData ? "setData" : mode,
        dataLength: data.length,
        lastTime,
      };

      if (isBandIndicator(indicator.instanceId)) {
        const bandData = calculateBandIndicator(indicator, data);
        if (!bandData?.length) continue;

        const entry: IndicatorRenderEntry = {
          type: "band",
          data: bandData,
          lastPoint: bandData[bandData.length - 1],
          meta,
        };

        newResults.set(indicator.instanceId, entry);
        cache.set(indicator.instanceId, { cacheKey, paramsKey, entry });
        cacheModified = true;
        continue;
      }

      const lineData = calculateLineIndicator(indicator, data);
      if (!lineData?.length) continue;

      const entry: IndicatorRenderEntry = {
        type: indicator.config.output === "histogram" ? "histogram" : "line",
        data: lineData,
        lastPoint: lineData[lineData.length - 1],
        meta,
      };

      newResults.set(indicator.instanceId, entry);
      cache.set(indicator.instanceId, { cacheKey, paramsKey, entry });
      cacheModified = true;
    }

    // Persist cache updates to refs (no re-render triggered)
    if (cacheModified) {
      indicatorCacheRef.current = cache;
    }
    previousSourceRef.current = sourceState;

    return newResults;
  }, [activeIndicators, data]);

  return results;
};
