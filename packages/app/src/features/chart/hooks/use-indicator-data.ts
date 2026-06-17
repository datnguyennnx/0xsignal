import { useMemo } from "react";
import type { ChartDataPoint, ActiveIndicator } from "@0xsignal/shared";
import { calculateLineIndicator, calculateBandIndicator, isBandIndicator } from "@0xsignal/shared";
import type { IndicatorDataMeta, IndicatorRenderEntry } from "../utils/indicator-data";

const MAX_CACHE_SIZE = 50;

/** Module-level LRU cache. Keyed by comprehensive fingerprint — no cross-symbol conflicts. */
const _cache = new Map<string, IndicatorRenderEntry>();

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
  lastSignature: string,
): string => {
  return `${indicatorId}#${paramsKey}#${dataLength}#${firstTime}#${lastTime}#${lastSignature}`;
};

/** Evict LRU if at capacity, then cache the entry. */
const setCacheEntry = (cacheKey: string, entry: IndicatorRenderEntry): void => {
  if (_cache.size >= MAX_CACHE_SIZE) {
    const firstKey = _cache.keys().next().value;
    if (firstKey !== undefined) _cache.delete(firstKey);
  }
  _cache.set(cacheKey, entry);
};

export const useIndicatorData = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]) => {
  return useMemo(() => {
    if (data.length === 0) {
      _cache.clear();
      return new Map<string, IndicatorRenderEntry>();
    }

    const firstTime = data[0].time;
    const lastTime = data[data.length - 1].time;
    const last = data[data.length - 1];
    const lastSignature = `${last.open}|${last.high}|${last.low}|${last.close}|${last.volume}`;

    const results = new Map<string, IndicatorRenderEntry>();

    for (const indicator of activeIndicators) {
      if (!indicator.visible) continue;

      const paramsKey = buildParamsKey(indicator.params);
      const cacheKey = buildCacheKey(
        indicator.instanceId,
        paramsKey,
        data.length,
        lastTime,
        firstTime,
        lastSignature,
      );

      const cached = _cache.get(cacheKey);
      if (cached) {
        // Bump to front (re-insert to maintain LRU order)
        _cache.delete(cacheKey);
        _cache.set(cacheKey, cached);
        results.set(indicator.instanceId, cached);
        continue;
      }

      const meta: IndicatorDataMeta = {
        cacheKey,
        paramsKey,
        mode: "setData",
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
        setCacheEntry(cacheKey, entry);
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
      setCacheEntry(cacheKey, entry);
    }

    return results;
  }, [activeIndicators, data]);
};
