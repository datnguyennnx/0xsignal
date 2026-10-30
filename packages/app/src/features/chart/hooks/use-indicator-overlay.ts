import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi, IPaneApi, Time } from "lightweight-charts";
import { LineSeries, HistogramSeries } from "lightweight-charts";
import type { ActiveIndicator } from "@0xsignal/shared";
import {
  getIndicatorBaseId,
  getIndicatorConfigById,
  isBandIndicator,
  isHistogramIndicator,
} from "@0xsignal/shared";
import { BandPrimitive } from "../utils/band";
import type { IndicatorRenderEntry } from "../utils/indicator-data";
import { toRgb, toRgba } from "../lib/color";
import { toUtcTimestamps } from "../lib/time";
import { formatAxis } from "@/core/utils/formatters";

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

const createOscillatorPriceFormat = () => ({
  type: "custom" as const,
  formatter: (price: number) => formatAxis(price),
});

const readToken = (token: string): string =>
  toRgb(getComputedStyle(document.documentElement).getPropertyValue(token).trim());

const createLineOptions = (color?: string) => ({
  ...(color !== undefined && { color }),
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
    if (chart === null) return;

    for (const ref of lineSeriesRefs.current.values()) {
      try {
        chart.removeSeries(ref.series);
      } catch {
        /* ignore chart disposal race */
      }
    }

    for (const ref of bandPrimitiveRefs.current.values()) {
      if (mainSeries !== null && mainSeries !== undefined) {
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
    if (chart === null) return;
    const panes = chart.panes();
    volumePaneRef.current = panes.length > 1 ? (panes.at(-1) ?? null) : null;
  }, [chart]);

  const removeIndicator = useCallback(
    (instanceId: string, isBand: boolean) => {
      if (isBand) {
        const bandRef = bandPrimitiveRefs.current.get(instanceId);
        if (bandRef !== undefined && mainSeries !== null && mainSeries !== undefined) {
          try {
            mainSeries.detachPrimitive(bandRef.primitive);
          } catch {}
          bandPrimitiveRefs.current.delete(instanceId);
        }
      } else {
        const seriesRef = lineSeriesRefs.current.get(instanceId);
        if (seriesRef !== undefined && chart !== null) {
          try {
            chart.removeSeries(seriesRef.series);
          } catch {}
          lineSeriesRefs.current.delete(instanceId);
        }
      }
      appliedCacheKeyRef.current.delete(instanceId);
    },
    [chart, mainSeries],
  );

  const removeOscillator = useCallback(
    (instanceId: string) => {
      if (chart === null) return;
      const seriesRef = lineSeriesRefs.current.get(instanceId);
      if (seriesRef === undefined) return;
      try {
        chart.removeSeries(seriesRef.series);
      } catch {}
      lineSeriesRefs.current.delete(instanceId);
      appliedCacheKeyRef.current.delete(instanceId);

      const paneState = paneByIndicatorRef.current.get(instanceId);
      if (paneState !== undefined) {
        const panes = chart.panes();
        const paneIdx = panes.indexOf(paneState.pane);
        if (paneIdx > 0) {
          try {
            chart.removePane(paneIdx);
          } catch {}
        }
        paneByIndicatorRef.current.delete(instanceId);
      }
    },
    [chart],
  );

  const renderLineOverlay = useCallback(
    (instanceId: string, data: IndicatorRenderEntry, color?: string) => {
      if (chart === null || data.type === "band") return;

      let seriesRef = lineSeriesRefs.current.get(instanceId);
      if (seriesRef === undefined) {
        const lineSeries = chart.addSeries(LineSeries, createLineOptions(color));
        seriesRef = { series: lineSeries, indicatorId: instanceId };
        lineSeriesRefs.current.set(instanceId, seriesRef);
      }
      const lineData = toUtcTimestamps(data.data);
      if (lineData.length > 0) seriesRef.series.setData(lineData);
    },
    [chart],
  );

  const renderBandOverlay = useCallback(
    (instanceId: string, data: IndicatorRenderEntry, color?: string) => {
      if (data.type !== "band") return;

      const bandData = toUtcTimestamps(data.data);
      const first = bandData[0];
      const last = bandData.at(-1);
      if (first === undefined || last === undefined) return;

      const safeColor = color !== undefined && color !== "" ? color : readToken("--data-crosshair");

      let bandRef = bandPrimitiveRefs.current.get(instanceId);
      if (bandRef === undefined && mainSeries !== null && mainSeries !== undefined) {
        const primitive = new BandPrimitive({
          startTime: first.time,
          endTime: last.time,
          levels: [],
          fillBetween: [],
        });
        mainSeries.attachPrimitive(primitive);
        bandRef = { primitive };
        bandPrimitiveRefs.current.set(instanceId, bandRef);
      }

      if (bandRef !== undefined) {
        bandRef.primitive.updateOptions({
          startTime: first.time,
          endTime: last.time,
          levels: [
            {
              price: last.upper,
              color: safeColor,
              lineWidth: 1,
              label: "Upper",
            },
            {
              price: last.middle,
              color: safeColor,
              lineWidth: 1,
              dashed: true,
              label: "Basis",
            },
            {
              price: last.lower,
              color: safeColor,
              lineWidth: 1,
              label: "Lower",
            },
          ],
          fillBetween: [
            {
              top: last.upper,
              bottom: last.lower,
              color: toRgba(safeColor, 0.05),
            },
          ],
        });
      }
    },
    [mainSeries],
  );

  const renderOscillator = useCallback(
    (instanceId: string, data: IndicatorRenderEntry, color?: string) => {
      if (chart === null || data.type === "band") return;

      let paneState = paneByIndicatorRef.current.get(instanceId);
      if (paneState === undefined) {
        const pane = chart.addPane();
        paneState = { pane, indicatorId: instanceId };
        paneByIndicatorRef.current.set(instanceId, paneState);
        pane.setHeight(150);
      }

      let seriesRef = lineSeriesRefs.current.get(instanceId);
      const baseId = getIndicatorBaseId(instanceId);
      const config = getIndicatorConfigById(baseId);
      const isHistogram = config?.output === "histogram" || isHistogramIndicator(instanceId);

      if (seriesRef === undefined) {
        const priceFormat = createOscillatorPriceFormat();
        const series = isHistogram
          ? paneState.pane.addSeries(HistogramSeries, {
              ...(color !== undefined && { color }),
              priceFormat,
            })
          : paneState.pane.addSeries(LineSeries, { ...createLineOptions(color), priceFormat });
        seriesRef = { series, indicatorId: instanceId };
        lineSeriesRefs.current.set(instanceId, seriesRef);
      }

      seriesRef.series.setData(toUtcTimestamps(data.data));
    },
    [chart],
  );

  useEffect(() => {
    if (chart === null) return;

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
      return (
        d === undefined || appliedCacheKeyRef.current.get(indicator.instanceId) !== d.meta.cacheKey
      );
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
      if (paneState !== undefined && paneState.pane !== volumePaneRef.current) {
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

    for (const [instanceId, bandRef] of bandPrimitiveRefs.current) {
      if (activeIds.has(instanceId)) continue;
      if (mainSeries !== null && mainSeries !== undefined) {
        try {
          mainSeries.detachPrimitive(bandRef.primitive);
        } catch {
          /* ignore */
        }
      }
      bandPrimitiveRefs.current.delete(instanceId);
      appliedCacheKeyRef.current.delete(instanceId);
    }

    if (chart.panes().length === 0) return;

    for (const indicator of activeIndicators) {
      if (!indicator.config.overlayOnPrice) continue;

      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);
      const isBand = isBandIndicator(instanceId);

      if (!indicator.visible || data === undefined) {
        removeIndicator(instanceId, isBand);
        continue;
      }

      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) continue;

      const color =
        indicator.color !== undefined && indicator.color !== ""
          ? toRgb(indicator.color)
          : undefined;

      if (isBand) {
        renderBandOverlay(instanceId, data, color);
      } else {
        renderLineOverlay(instanceId, data, color);
      }

      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    for (const indicator of activeIndicators) {
      if (indicator.config.overlayOnPrice) continue;

      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);

      if (!indicator.visible || data === undefined) {
        removeOscillator(instanceId);
        continue;
      }

      if (appliedCacheKeyRef.current.get(instanceId) === data.meta.cacheKey) continue;

      const color =
        indicator.color !== undefined && indicator.color !== ""
          ? toRgb(indicator.color)
          : undefined;

      renderOscillator(instanceId, data, color);
      appliedCacheKeyRef.current.set(instanceId, data.meta.cacheKey);
    }

    const currentPanes = chart.panes();
    if (currentPanes.length > 1) {
      currentPanes[0].setStretchFactor(1000);
      volumePaneRef.current?.setStretchFactor(200);
      currentPanes.slice(1).forEach((p) => {
        if (p !== volumePaneRef.current) p.setStretchFactor(300);
      });
    }
  }, [
    chart,
    mainSeries,
    activeIndicators,
    indicatorData,
    removeIndicator,
    removeOscillator,
    renderBandOverlay,
    renderLineOverlay,
    renderOscillator,
  ]);

  useEffect(() => {
    return () => {
      clearAllSeries();
    };
  }, [clearAllSeries]);

  return {};
};
