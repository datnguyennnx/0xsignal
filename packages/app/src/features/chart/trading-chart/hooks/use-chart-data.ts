/**
 * @overview Indicator Data Calculation Hook
 *
 * Transforms raw candlestick data into indicator time-series (Line, Band, Histogram).
 * Uses a pure useMemo computation with cacheKey-based idempotency for downstream consumers.
 */
import { useMemo } from "react";
import type { ChartDataPoint, ActiveIndicator } from "@0xsignal/shared";
import { calculateLineIndicator, calculateBandIndicator, isBandIndicator } from "@0xsignal/shared";
import type { IndicatorDataMeta, IndicatorRenderEntry } from "./indicator-data.types";

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

export const useIndicatorData = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]) => {
  return useMemo(() => {
    if (data.length === 0) {
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
        lastSignature
      );

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

        results.set(indicator.instanceId, {
          type: "band",
          data: bandData,
          lastPoint: bandData[bandData.length - 1],
          meta,
        });
        continue;
      }

      const lineData = calculateLineIndicator(indicator, data);
      if (!lineData?.length) continue;

      results.set(indicator.instanceId, {
        type: indicator.config.output === "histogram" ? "histogram" : "line",
        data: lineData,
        lastPoint: lineData[lineData.length - 1],
        meta,
      });
    }

    return results;
  }, [activeIndicators, data]);
};
