/** @fileoverview Indicator overlay hook - renders indicators on the chart using Pane API */
import { useEffect, useRef, useCallback, useMemo } from "react";
import type {
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  HistogramData,
  IPaneApi,
} from "lightweight-charts";
import type { ActiveIndicator, BandIndicatorDataPoint } from "@0xsignal/shared";
import { LineSeries, HistogramSeries } from "lightweight-charts";
import {
  getIndicatorBaseId,
  getIndicatorConfigById,
  isBandIndicator,
  isHistogramIndicator,
} from "@0xsignal/shared";
import type { IndicatorRenderEntry } from "./indicator-data.types";

interface UseIndicatorOverlayProps {
  chart: IChartApi | null;
  activeIndicators: ActiveIndicator[];
  indicatorData: Map<string, IndicatorRenderEntry>;
}

interface IndicatorSeriesRef {
  series: ISeriesApi<"Line"> | ISeriesApi<"Histogram">;
  indicatorId: string;
}

interface BandSeriesRef {
  upper: ISeriesApi<"Line">;
  middle: ISeriesApi<"Line">;
  lower: ISeriesApi<"Line">;
}

interface PaneState {
  pane: IPaneApi<Time>;
  indicatorId: string;
}

const oscillatorPriceFormat = {
  type: "custom" as const,
  formatter: (price: number) => {
    if (!Number.isFinite(price) || price === 0) return "0";
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  },
};

const createBandLineOptions = (color: string) => ({
  color,
  lineWidth: 1 as const,
  lastValueVisible: false,
  priceLineVisible: false,
});

const createLineOptions = (color?: string) => ({
  color,
  lineWidth: 2 as const,
  lastValueVisible: true,
  priceLineVisible: false,
  crosshairMarkerVisible: true,
});

export const useIndicatorOverlay = ({
  chart,
  activeIndicators,
  indicatorData,
}: UseIndicatorOverlayProps) => {
  const lineSeriesRefs = useRef<Map<string, IndicatorSeriesRef>>(new Map());
  const bandSeriesRefs = useRef<Map<string, BandSeriesRef>>(new Map());
  const paneByIndicatorRef = useRef<Map<string, PaneState>>(new Map());
  const appliedCacheKeyRef = useRef<Map<string, string>>(new Map());
  const volumePaneRef = useRef<IPaneApi<Time> | null>(null);

  const overlayIndicators = useMemo(
    () => activeIndicators.filter((indicator) => indicator.config.overlayOnPrice),
    [activeIndicators]
  );

  const oscillatorIndicators = useMemo(
    () => activeIndicators.filter((indicator) => !indicator.config.overlayOnPrice),
    [activeIndicators]
  );

  const clearAllSeries = useCallback(() => {
    if (!chart) return;

    for (const ref of lineSeriesRefs.current.values()) {
      try {
        chart.removeSeries(ref.series);
      } catch {
        // ignore chart disposal race
      }
    }

    for (const bandRef of bandSeriesRefs.current.values()) {
      try {
        chart.removeSeries(bandRef.upper);
        chart.removeSeries(bandRef.middle);
        chart.removeSeries(bandRef.lower);
      } catch {
        // ignore chart disposal race
      }
    }

    const panes = chart.panes();
    for (let idx = panes.length - 1; idx >= 0; idx--) {
      const pane = panes[idx];
      if (pane !== panes[0] && pane !== volumePaneRef.current) {
        try {
          chart.removePane(idx);
        } catch {
          // ignore pane removal race
        }
      }
    }

    lineSeriesRefs.current.clear();
    bandSeriesRefs.current.clear();
    paneByIndicatorRef.current.clear();
    appliedCacheKeyRef.current.clear();
  }, [chart]);

  useEffect(() => {
    if (!chart) return;
    const panes = chart.panes();
    volumePaneRef.current = panes.length > 1 ? panes[panes.length - 1] : null;
  }, [chart]);

  useEffect(() => {
    if (!chart) return;

    const activeIds = new Set(activeIndicators.map((indicator) => indicator.instanceId));

    for (const [instanceId, ref] of lineSeriesRefs.current) {
      if (activeIds.has(instanceId)) continue;

      try {
        chart.removeSeries(ref.series);
      } catch {
        // ignore missing series
      }
      lineSeriesRefs.current.delete(instanceId);
      appliedCacheKeyRef.current.delete(instanceId);

      const paneState = paneByIndicatorRef.current.get(instanceId);
      if (!paneState) continue;

      const currentPanes = chart.panes();
      const paneIndex = currentPanes.indexOf(paneState.pane);
      if (paneIndex > 0 && paneState.pane !== volumePaneRef.current) {
        try {
          chart.removePane(paneIndex);
        } catch {
          // ignore if pane already gone
        }
      }
      paneByIndicatorRef.current.delete(instanceId);
    }

    for (const [instanceId, bandRef] of bandSeriesRefs.current) {
      if (activeIds.has(instanceId)) continue;
      try {
        chart.removeSeries(bandRef.upper);
        chart.removeSeries(bandRef.middle);
        chart.removeSeries(bandRef.lower);
      } catch {
        // ignore missing series
      }
      bandSeriesRefs.current.delete(instanceId);
      appliedCacheKeyRef.current.delete(instanceId);
    }

    const panes = chart.panes();
    const mainPane = panes[0];
    if (!mainPane) return;

    for (const indicator of overlayIndicators) {
      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);
      if (!data) continue;

      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) {
        continue;
      }

      if (!indicator.visible) {
        const lineRef = lineSeriesRefs.current.get(instanceId);
        if (lineRef) {
          try {
            chart.removeSeries(lineRef.series);
          } catch {
            // ignore missing series
          }
          lineSeriesRefs.current.delete(instanceId);
          appliedCacheKeyRef.current.delete(instanceId);
        }

        const bandRef = bandSeriesRefs.current.get(instanceId);
        if (bandRef) {
          try {
            chart.removeSeries(bandRef.upper);
            chart.removeSeries(bandRef.middle);
            chart.removeSeries(bandRef.lower);
          } catch {
            // ignore missing series
          }
          bandSeriesRefs.current.delete(instanceId);
          appliedCacheKeyRef.current.delete(instanceId);
        }

        continue;
      }

      if (data.type === "band" || isBandIndicator(instanceId)) {
        const bandData = data.data as BandIndicatorDataPoint[];
        if (!bandData.length) continue;

        let bandRef = bandSeriesRefs.current.get(instanceId);
        let isNewBandSeries = false;
        if (!bandRef) {
          const color = indicator.color || "#8884d8";
          bandRef = {
            upper: mainPane.addSeries(LineSeries, createBandLineOptions(color)),
            middle: mainPane.addSeries(LineSeries, createBandLineOptions(color)),
            lower: mainPane.addSeries(LineSeries, createBandLineOptions(color)),
          };
          bandSeriesRefs.current.set(instanceId, bandRef);
          isNewBandSeries = true;
        }

        const upperData: LineData<Time>[] = new Array(bandData.length);
        const middleData: LineData<Time>[] = new Array(bandData.length);
        const lowerData: LineData<Time>[] = new Array(bandData.length);

        for (let idx = 0; idx < bandData.length; idx++) {
          const point = bandData[idx];
          const time = point.time as Time;
          upperData[idx] = { time, value: point.upper };
          middleData[idx] = { time, value: point.middle };
          lowerData[idx] = { time, value: point.lower };
        }

        if (!isNewBandSeries && (data.meta.mode === "append" || data.meta.mode === "replaceLast")) {
          const lastPoint = data.lastPoint as BandIndicatorDataPoint | null;
          if (lastPoint) {
            const time = lastPoint.time as Time;
            bandRef.upper.update({ time, value: lastPoint.upper });
            bandRef.middle.update({ time, value: lastPoint.middle });
            bandRef.lower.update({ time, value: lastPoint.lower });
          }
        } else {
          bandRef.upper.setData(upperData);
          bandRef.middle.setData(middleData);
          bandRef.lower.setData(lowerData);
        }

        appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
        continue;
      }

      let seriesRef = lineSeriesRefs.current.get(instanceId);
      let isNewLineSeries = false;
      if (!seriesRef) {
        const lineSeries = mainPane.addSeries(LineSeries, createLineOptions(indicator.color));
        seriesRef = { series: lineSeries, indicatorId: instanceId };
        lineSeriesRefs.current.set(instanceId, seriesRef);
        isNewLineSeries = true;
      }

      const lineData = data.data as LineData<Time>[];
      const lineSeries = seriesRef.series as ISeriesApi<"Line">;
      if (lineData.length > 0) {
        if (!isNewLineSeries && (data.meta.mode === "append" || data.meta.mode === "replaceLast")) {
          const lastPoint = data.lastPoint as LineData<Time> | null;
          if (lastPoint) {
            lineSeries.update(lastPoint);
          } else {
            lineSeries.setData(lineData);
          }
        } else {
          lineSeries.setData(lineData);
        }
      }

      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    for (const indicator of oscillatorIndicators) {
      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);
      if (!data) continue;

      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) {
        continue;
      }

      if (!indicator.visible) {
        const lineRef = lineSeriesRefs.current.get(instanceId);
        if (lineRef) {
          try {
            chart.removeSeries(lineRef.series);
          } catch {
            // ignore missing series
          }
          lineSeriesRefs.current.delete(instanceId);
          appliedCacheKeyRef.current.delete(instanceId);
        }

        const paneState = paneByIndicatorRef.current.get(instanceId);
        if (paneState) {
          const paneIndex = chart.panes().indexOf(paneState.pane);
          if (paneIndex > 0 && paneState.pane !== volumePaneRef.current) {
            try {
              chart.removePane(paneIndex);
            } catch {
              // ignore removal errors
            }
          }
          paneByIndicatorRef.current.delete(instanceId);
          appliedCacheKeyRef.current.delete(instanceId);
        }
        continue;
      }

      let paneState = paneByIndicatorRef.current.get(instanceId);
      if (!paneState) {
        const pane = chart.addPane();
        paneState = { pane, indicatorId: instanceId };
        paneByIndicatorRef.current.set(instanceId, paneState);
        try {
          pane.setHeight(150);
        } catch {
          // ignore pane sizing errors
        }
      }

      let seriesRef = lineSeriesRefs.current.get(instanceId);
      const baseId = getIndicatorBaseId(instanceId);
      const indicatorConfig = getIndicatorConfigById(baseId);
      const shouldUseHistogram = indicatorConfig?.output
        ? indicatorConfig.output === "histogram"
        : isHistogramIndicator(instanceId);
      let isNewSeries = false;

      if (!seriesRef) {
        if (shouldUseHistogram) {
          const histogramSeries = paneState.pane.addSeries(HistogramSeries, {
            color: indicator.color,
            priceFormat: oscillatorPriceFormat,
            lastValueVisible: true,
            priceLineVisible: false,
          });
          seriesRef = { series: histogramSeries, indicatorId: instanceId };
        } else {
          const lineSeries = paneState.pane.addSeries(LineSeries, {
            ...createLineOptions(indicator.color),
            priceFormat: oscillatorPriceFormat,
          });
          seriesRef = { series: lineSeries, indicatorId: instanceId };
        }

        lineSeriesRefs.current.set(instanceId, seriesRef);
        isNewSeries = true;
      }

      if (shouldUseHistogram) {
        const histData = data.data as HistogramData<Time>[];
        if (histData.length > 0) {
          const histSeries = seriesRef.series as ISeriesApi<"Histogram">;
          if (!isNewSeries && (data.meta.mode === "append" || data.meta.mode === "replaceLast")) {
            const lastPoint = data.lastPoint as HistogramData<Time> | null;
            if (lastPoint) {
              histSeries.update(lastPoint);
            } else {
              histSeries.setData(histData);
            }
          } else {
            histSeries.setData(histData);
          }
        }
      } else {
        const lineData = data.data as LineData<Time>[];
        if (lineData.length > 0) {
          const lineSeries = seriesRef.series as ISeriesApi<"Line">;
          if (!isNewSeries && (data.meta.mode === "append" || data.meta.mode === "replaceLast")) {
            const lastPoint = data.lastPoint as LineData<Time> | null;
            if (lastPoint) {
              lineSeries.update(lastPoint);
            } else {
              lineSeries.setData(lineData);
            }
          } else {
            lineSeries.setData(lineData);
          }
        }
      }

      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    const currentPanes = chart.panes();
    if (currentPanes.length > 1) {
      currentPanes[0]?.setStretchFactor(1000);
      const volumePane = volumePaneRef.current;
      if (volumePane) {
        volumePane.setStretchFactor(200);
      }

      for (const pane of currentPanes.slice(1)) {
        if (pane !== volumePane) {
          pane.setStretchFactor(300);
        }
      }
    }
  }, [chart, activeIndicators, indicatorData, overlayIndicators, oscillatorIndicators]);

  useEffect(() => {
    return () => {
      clearAllSeries();
    };
  }, [clearAllSeries]);

  return { clearAllSeries };
};
