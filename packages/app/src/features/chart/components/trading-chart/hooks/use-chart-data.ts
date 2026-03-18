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
  const cacheByIndicatorRef = useRef<Map<string, CacheEntry>>(new Map());
  const previousSourceRef = useRef<{
    firstTime: number;
    lastTime: number;
    dataLength: number;
  } | null>(null);

  return useMemo(() => {
    if (data.length === 0) {
      cacheByIndicatorRef.current.clear();
      previousSourceRef.current = null;
      return new Map<string, IndicatorRenderEntry>();
    }

    const firstTime = data[0].time;
    const lastTime = data[data.length - 1].time;
    const last = data[data.length - 1];
    const lastSignature = `${last.open}|${last.high}|${last.low}|${last.close}|${last.volume}`;
    const sourceState = { firstTime, lastTime, dataLength: data.length };
    const mode = resolveUpdateMode(previousSourceRef.current, sourceState);

    const results = new Map<string, IndicatorRenderEntry>();
    const activeIds = new Set(activeIndicators.map((indicator) => indicator.instanceId));

    for (const indicatorId of cacheByIndicatorRef.current.keys()) {
      if (!activeIds.has(indicatorId)) {
        cacheByIndicatorRef.current.delete(indicatorId);
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
      const cached = cacheByIndicatorRef.current.get(indicator.instanceId);
      if (cached?.cacheKey === cacheKey) {
        results.set(indicator.instanceId, cached.entry);
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

        results.set(indicator.instanceId, entry);
        cacheByIndicatorRef.current.set(indicator.instanceId, { cacheKey, paramsKey, entry });
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

      results.set(indicator.instanceId, entry);
      cacheByIndicatorRef.current.set(indicator.instanceId, { cacheKey, paramsKey, entry });
    }

    previousSourceRef.current = sourceState;
    return results;
  }, [activeIndicators, data]);
};
