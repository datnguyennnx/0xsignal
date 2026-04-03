/**
 * @overview Chart Indicator Overlay Hook
 *
 * Manages the rendering of technical indicators (Line, Histogram, Bands) on the main chart using the Pane API.
 * It handles the creation and destruction of secondary panes for oscillators and overlays for on-price indicators.
 *
 * @mechanism
 * - utilizes a cache map (appliedCacheKeyRef) to avoid redundant data synchronization.
 * - implements smart Pane management (addPane, removePane) to host oscillators like RSI/MACD.
 * - supports multi-layer rendering for Band indicators (Upper, Middle, Lower).
 */
import { useEffect, useRef, useCallback, useMemo } from "react";
import type { IChartApi, ISeriesApi, LineData, Time, IPaneApi } from "lightweight-charts";
import { LineSeries, HistogramSeries } from "lightweight-charts";
import type { ActiveIndicator, BandIndicatorDataPoint } from "@0xsignal/shared";
import {
  getIndicatorBaseId,
  getIndicatorConfigById,
  isBandIndicator,
  isHistogramIndicator,
} from "@0xsignal/shared";
import { BandPrimitive } from "../../ict/primitives";
import type { IndicatorRenderEntry } from "./indicator-data.types";

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

    for (const ref of bandPrimitiveRefs.current.values()) {
      if (mainSeries) {
        try {
          mainSeries.detachPrimitive(ref.primitive);
        } catch {
          // ignore cleanup race
        }
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
    bandPrimitiveRefs.current.clear();
    paneByIndicatorRef.current.clear();
    appliedCacheKeyRef.current.clear();
  }, [chart, mainSeries]);

  useEffect(() => {
    if (!chart) return;
    const panes = chart.panes();
    volumePaneRef.current = panes.length > 1 ? panes[panes.length - 1] : null;
  }, [chart]);

  useEffect(() => {
    if (!chart) return;

    const activeIds = new Set(activeIndicators.map((indicator) => indicator.instanceId));

    // Cleanup line series
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
      if (paneState) {
        const panes = chart.panes();
        const paneIndex = panes.indexOf(paneState.pane);
        if (paneIndex > 0 && paneState.pane !== volumePaneRef.current) {
          try {
            chart.removePane(paneIndex);
          } catch {
            /* ignore */
          }
        }
        paneByIndicatorRef.current.delete(instanceId);
      }
    }

    // Cleanup band primitives
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

    // Render Overlays (on main chart)
    for (const indicator of overlayIndicators) {
      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);
      const isBand = isBandIndicator(instanceId);

      // If hidden, remove series/primitive if it exists
      if (!indicator.visible || !data) {
        if (isBand) {
          const bandRef = bandPrimitiveRefs.current.get(instanceId);
          if (bandRef && mainSeries) {
            try {
              mainSeries.detachPrimitive(bandRef.primitive);
            } catch {}
            bandPrimitiveRefs.current.delete(instanceId);
            appliedCacheKeyRef.current.delete(instanceId);
          }
        } else {
          const seriesRef = lineSeriesRefs.current.get(instanceId);
          if (seriesRef) {
            try {
              chart.removeSeries(seriesRef.series);
            } catch {}
            lineSeriesRefs.current.delete(instanceId);
            appliedCacheKeyRef.current.delete(instanceId);
          }
        }
        continue;
      }

      // Check cache - if cache matches, we skip
      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) continue;

      if (isBand) {
        const bandData = data.data as BandIndicatorDataPoint[];
        if (!bandData.length) continue;

        let bandRef = bandPrimitiveRefs.current.get(instanceId);
        const startTime = bandData[0].time;
        const endTime = bandData[bandData.length - 1].time;
        const color = indicator.color || "#8884d8";

        if (!bandRef) {
          const primitive = new BandPrimitive({
            startTime,
            endTime,
            levels: [],
            fillBetween: [],
          });

          if (mainSeries) {
            mainSeries.attachPrimitive(primitive);
            bandRef = { primitive };
            bandPrimitiveRefs.current.set(instanceId, bandRef);
          }
        }

        if (bandRef) {
          bandRef.primitive.updateOptions({
            startTime,
            endTime,
            levels: [
              { price: bandData[bandData.length - 1].upper, color, lineWidth: 1, label: "Upper" },
              {
                price: bandData[bandData.length - 1].middle,
                color,
                lineWidth: 1,
                dashed: true,
                label: "Basis",
              },
              { price: bandData[bandData.length - 1].lower, color, lineWidth: 1, label: "Lower" },
            ],
            fillBetween: [
              {
                top: bandData[bandData.length - 1].upper,
                bottom: bandData[bandData.length - 1].lower,
                color: color.replace(")", ", 0.05)").replace("hsl", "hsla"),
              },
            ],
          });
        }

        appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
        continue;
      }

      // Line Overlays (MA, EMA, etc.)
      let seriesRef = lineSeriesRefs.current.get(instanceId);
      if (!seriesRef) {
        const lineSeries = chart.addSeries(LineSeries, createLineOptions(indicator.color));
        seriesRef = { series: lineSeries, indicatorId: instanceId };
        lineSeriesRefs.current.set(instanceId, seriesRef);
      }

      const lineData = data.data as LineData<Time>[];
      if (lineData.length > 0) {
        seriesRef.series.setData(lineData);
      }
      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    // Render Oscillators (secondary panes)
    for (const indicator of oscillatorIndicators) {
      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);

      if (!indicator.visible || !data) {
        const seriesRef = lineSeriesRefs.current.get(instanceId);
        if (seriesRef) {
          try {
            chart.removeSeries(seriesRef.series);
          } catch {}
          lineSeriesRefs.current.delete(instanceId);
          appliedCacheKeyRef.current.delete(instanceId);

          const paneState = paneByIndicatorRef.current.get(instanceId);
          if (paneState) {
            const panes = chart.panes();
            const paneIndex = panes.indexOf(paneState.pane);
            if (paneIndex > 0) {
              try {
                chart.removePane(paneIndex);
              } catch {}
            }
            paneByIndicatorRef.current.delete(instanceId);
          }
        }
        continue;
      }

      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) continue;

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
        const isOscillator = !indicator.config.overlayOnPrice;
        const priceFormat = isOscillator ? createOscillatorPriceFormat() : undefined;

        const series = isHistogram
          ? paneState.pane.addSeries(HistogramSeries, {
              color: indicator.color,
              priceFormat,
            })
          : paneState.pane.addSeries(LineSeries, {
              ...createLineOptions(indicator.color),
              priceFormat,
            });

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
      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    // Adjust pane ratios
    const currentPanes = chart.panes();
    if (currentPanes.length > 1) {
      currentPanes[0].setStretchFactor(1000);
      if (volumePaneRef.current) volumePaneRef.current.setStretchFactor(200);
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
