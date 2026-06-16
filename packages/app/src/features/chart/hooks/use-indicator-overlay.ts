import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi, LineData, Time, IPaneApi } from "lightweight-charts";
import { LineSeries, HistogramSeries } from "lightweight-charts";
import type { ActiveIndicator, BandIndicatorDataPoint } from "@0xsignal/shared";
import {
  getIndicatorBaseId,
  getIndicatorConfigById,
  isBandIndicator,
  isHistogramIndicator,
} from "@0xsignal/shared";
import { BandPrimitive } from "../utils/band";
import type { IndicatorRenderEntry } from "../utils/indicator-data";

interface UseIndicatorOverlayProps {
  chart: IChartApi | null;
  mainSeries?: ISeriesApi<"Candlestick"> | null;
  activeIndicators: ActiveIndicator[];
  indicatorData: Map<string, IndicatorRenderEntry>;
}

interface IndicatorSeriesRef {
  series: ISeriesApi<"Line"> | ISeriesApi<"Histogram">;
  indicatorId: string;
}

interface BandPrimitiveRef {
  primitive: BandPrimitive;
}

interface PaneState {
  pane: IPaneApi<Time>;
  indicatorId: string;
}

const createOscillatorPriceFormat = (minDecimals = 2, maxDecimals = 4) => ({
  type: "custom" as const,
  formatter: (price: number) => {
    if (!Number.isFinite(price) || price === 0) return "0";
    return price.toLocaleString("en-US", {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
  },
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
  mainSeries,
  activeIndicators,
  indicatorData,
}: UseIndicatorOverlayProps) => {
  const lineSeriesRefs = useRef<Map<string, IndicatorSeriesRef>>(new Map());
  const bandPrimitiveRefs = useRef<Map<string, BandPrimitiveRef>>(new Map());
  const paneByIndicatorRef = useRef<Map<string, PaneState>>(new Map());
  const appliedCacheKeyRef = useRef<Map<string, string>>(new Map());
  const volumePaneRef = useRef<IPaneApi<Time> | null>(null);

  const clearAllSeries = useCallback(() => {
    if (!chart) return;

    for (const ref of lineSeriesRefs.current.values()) {
      try {
        chart.removeSeries(ref.series);
      } catch {
        /* ignore chart disposal race */
      }
    }

    for (const ref of bandPrimitiveRefs.current.values()) {
      if (mainSeries) {
        try {
          mainSeries.detachPrimitive(ref.primitive);
        } catch {
          /* ignore cleanup race */
        }
      }
    }

    const panes = chart.panes();
    // Remove all non-volume panes (iterating backwards to preserve indices)
    for (let idx = panes.length - 1; idx >= 0; idx--) {
      if (idx > 0 && panes[idx] !== volumePaneRef.current) {
        try {
          chart.removePane(idx);
        } catch {
          /* ignore */
        }
      }
    }

    lineSeriesRefs.current.clear();
    bandPrimitiveRefs.current.clear();
    paneByIndicatorRef.current.clear();
    appliedCacheKeyRef.current.clear();
  }, [chart, mainSeries]);

  useEffect(() => {
    if (!chart) return;
    const panes = chart.panes();
    volumePaneRef.current = panes.length > 1 ? panes[panes.length - 1] : null;
  }, [chart]);

  // Helper functions (called from effect below)

  const removeIndicator = (
    chart: IChartApi,
    mainSeries: ISeriesApi<"Candlestick"> | null | undefined,
    instanceId: string,
    isBand: boolean
  ) => {
    if (isBand) {
      const bandRef = bandPrimitiveRefs.current.get(instanceId);
      if (bandRef && mainSeries) {
        try {
          mainSeries.detachPrimitive(bandRef.primitive);
        } catch {}
        bandPrimitiveRefs.current.delete(instanceId);
      }
    } else {
      const seriesRef = lineSeriesRefs.current.get(instanceId);
      if (seriesRef) {
        try {
          chart.removeSeries(seriesRef.series);
        } catch {}
        lineSeriesRefs.current.delete(instanceId);
      }
    }
    appliedCacheKeyRef.current.delete(instanceId);
  };

  const removeOscillator = (chart: IChartApi, instanceId: string) => {
    const seriesRef = lineSeriesRefs.current.get(instanceId);
    if (!seriesRef) return;
    try {
      chart.removeSeries(seriesRef.series);
    } catch {}
    lineSeriesRefs.current.delete(instanceId);
    appliedCacheKeyRef.current.delete(instanceId);

    const paneState = paneByIndicatorRef.current.get(instanceId);
    if (paneState) {
      const panes = chart.panes();
      const paneIdx = panes.indexOf(paneState.pane);
      if (paneIdx > 0) {
        try {
          chart.removePane(paneIdx);
        } catch {}
      }
      paneByIndicatorRef.current.delete(instanceId);
    }
  };

  const renderLineOverlay = (
    chart: IChartApi,
    instanceId: string,
    data: IndicatorRenderEntry,
    color?: string
  ) => {
    let seriesRef = lineSeriesRefs.current.get(instanceId);
    if (!seriesRef) {
      const lineSeries = chart.addSeries(LineSeries, createLineOptions(color));
      seriesRef = { series: lineSeries, indicatorId: instanceId };
      lineSeriesRefs.current.set(instanceId, seriesRef);
    }
    const lineData = data.data as LineData<Time>[];
    if (lineData.length > 0) seriesRef.series.setData(lineData);
  };

  const renderBandOverlay = (
    mainSeries: ISeriesApi<"Candlestick"> | null | undefined,
    instanceId: string,
    data: IndicatorRenderEntry,
    color?: string
  ) => {
    const bandData = data.data as BandIndicatorDataPoint[];
    if (!bandData.length) return;
    const safeColor = color || "#8884d8";

    let bandRef = bandPrimitiveRefs.current.get(instanceId);
    if (!bandRef && mainSeries) {
      const primitive = new BandPrimitive({
        startTime: bandData[0].time,
        endTime: bandData[bandData.length - 1].time,
        levels: [],
        fillBetween: [],
      });
      mainSeries.attachPrimitive(primitive);
      bandRef = { primitive };
      bandPrimitiveRefs.current.set(instanceId, bandRef);
    }

    if (bandRef) {
      bandRef.primitive.updateOptions({
        startTime: bandData[0].time,
        endTime: bandData[bandData.length - 1].time,
        levels: [
          {
            price: bandData[bandData.length - 1].upper,
            color: safeColor,
            lineWidth: 1,
            label: "Upper",
          },
          {
            price: bandData[bandData.length - 1].middle,
            color: safeColor,
            lineWidth: 1,
            dashed: true,
            label: "Basis",
          },
          {
            price: bandData[bandData.length - 1].lower,
            color: safeColor,
            lineWidth: 1,
            label: "Lower",
          },
        ],
        fillBetween: [
          {
            top: bandData[bandData.length - 1].upper,
            bottom: bandData[bandData.length - 1].lower,
            color: safeColor.replace(")", ", 0.05)").replace("hsl", "hsla"),
          },
        ],
      });
    }
  };

  const renderOscillator = (
    chart: IChartApi,
    instanceId: string,
    data: IndicatorRenderEntry,
    color?: string
  ) => {
    let paneState = paneByIndicatorRef.current.get(instanceId);
    if (!paneState) {
      const pane = chart.addPane();
      paneState = { pane, indicatorId: instanceId };
      paneByIndicatorRef.current.set(instanceId, paneState);
      pane.setHeight(150);
    }

    let seriesRef = lineSeriesRefs.current.get(instanceId);
    const baseId = getIndicatorBaseId(instanceId);
    const config = getIndicatorConfigById(baseId);
    const isHistogram = config?.output === "histogram" || isHistogramIndicator(instanceId);

    if (!seriesRef) {
      const priceFormat = createOscillatorPriceFormat();
      const series = isHistogram
        ? paneState.pane.addSeries(HistogramSeries, { color, priceFormat })
        : paneState.pane.addSeries(LineSeries, { ...createLineOptions(color), priceFormat });
      seriesRef = { series, indicatorId: instanceId };
      lineSeriesRefs.current.set(instanceId, seriesRef);
    }

    if (isHistogram) {
      (seriesRef.series as ISeriesApi<"Histogram">).setData(
        data.data as import("lightweight-charts").HistogramData<Time>[]
      );
    } else {
      (seriesRef.series as ISeriesApi<"Line">).setData(
        data.data as import("lightweight-charts").LineData<Time>[]
      );
    }
  };

  useEffect(() => {
    if (!chart) return;

    // Quick check: skip when no visible indicators need updating
    let needsRender = activeIndicators.some((indicator) => {
      if (!indicator.visible) {
        // Hidden but we have a series → needs cleanup
        return (
          lineSeriesRefs.current.has(indicator.instanceId) ||
          bandPrimitiveRefs.current.has(indicator.instanceId)
        );
      }
      const d = indicatorData.get(indicator.instanceId);
      // Missing data or cache mismatch → needs recalculation
      return !d || appliedCacheKeyRef.current.get(indicator.instanceId) !== d.meta.cacheKey;
    });
    // Also check for indicators removed from the active list entirely
    if (!needsRender) {
      const currentIds = new Set(activeIndicators.map((i) => i.instanceId));
      for (const id of lineSeriesRefs.current.keys()) {
        if (!currentIds.has(id)) {
          needsRender = true;
          break;
        }
      }
    }
    if (!needsRender) {
      for (const id of bandPrimitiveRefs.current.keys()) {
        if (!activeIndicators.some((i) => i.instanceId === id)) {
          needsRender = true;
          break;
        }
      }
    }
    if (!needsRender) return;

    const activeIds = new Set(activeIndicators.map((indicator) => indicator.instanceId));

    // Cleanup removed indicators
    // Line series cleanup
    for (const [instanceId, ref] of lineSeriesRefs.current) {
      if (activeIds.has(instanceId)) continue;
      try {
        chart.removeSeries(ref.series);
      } catch {
        /* ignore */
      }
      lineSeriesRefs.current.delete(instanceId);
      appliedCacheKeyRef.current.delete(instanceId);

      const paneState = paneByIndicatorRef.current.get(instanceId);
      if (paneState && paneState.pane !== volumePaneRef.current) {
        const panes = chart.panes();
        const paneIdx = panes.indexOf(paneState.pane);
        if (paneIdx > 0) {
          try {
            chart.removePane(paneIdx);
          } catch {
            /* ignore */
          }
        }
        paneByIndicatorRef.current.delete(instanceId);
      }
    }

    // Band primitive cleanup
    for (const [instanceId, bandRef] of bandPrimitiveRefs.current) {
      if (activeIds.has(instanceId)) continue;
      if (mainSeries) {
        try {
          mainSeries.detachPrimitive(bandRef.primitive);
        } catch {
          /* ignore */
        }
      }
      bandPrimitiveRefs.current.delete(instanceId);
      appliedCacheKeyRef.current.delete(instanceId);
    }

    const mainPane = chart.panes()[0];
    if (!mainPane) return;

    // Render Overlay Indicators (on main chart)
    for (const indicator of activeIndicators) {
      if (!indicator.config.overlayOnPrice) continue;

      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);
      const isBand = isBandIndicator(instanceId);

      // Remove if hidden or no data
      if (!indicator.visible || !data) {
        removeIndicator(chart, mainSeries, instanceId, isBand);
        continue;
      }

      // Cache hit — skip
      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) continue;

      if (isBand) {
        renderBandOverlay(mainSeries, instanceId, data, indicator.color);
      } else {
        renderLineOverlay(chart, instanceId, data, indicator.color);
      }

      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    // Render Oscillator Indicators (secondary panes)
    for (const indicator of activeIndicators) {
      if (indicator.config.overlayOnPrice) continue;

      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);

      // Remove if hidden or no data
      if (!indicator.visible || !data) {
        removeOscillator(chart, instanceId);
        continue;
      }

      // Cache hit — skip
      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) continue;

      renderOscillator(chart, instanceId, data, indicator.color);
      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    // Adjust pane ratios
    const currentPanes = chart.panes();
    if (currentPanes.length > 1) {
      currentPanes[0].setStretchFactor(1000);
      volumePaneRef.current?.setStretchFactor(200);
      currentPanes.slice(1).forEach((p) => {
        if (p !== volumePaneRef.current) p.setStretchFactor(300);
      });
    }
  }, [chart, mainSeries, activeIndicators, indicatorData]);

  useEffect(() => {
    return () => {
      clearAllSeries();
    };
  }, [clearAllSeries]);

  return { clearAllSeries };
};
