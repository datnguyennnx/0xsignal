import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi, IPaneApi, Time } from "lightweight-charts";
import { LineSeries, HistogramSeries } from "lightweight-charts";
import type { ActiveIndicator, BandIndicatorDataPoint, IndicatorDataPoint } from "@0xsignal/shared";
import {
  getIndicatorBaseId,
  getIndicatorConfigById,
  isBandIndicator,
  isHistogramIndicator,
} from "@0xsignal/shared";
import { BandPrimitive } from "../utils/band";
import type { IndicatorRenderEntry } from "../utils/indicator-data";
import { toRgb, toRgba } from "../lib/color";
import { getSeriesColor, useChartTheme } from "../lib/theme-store";
import { toUtcTimestamps, type UtcDated } from "../lib/time";
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
  /** Points the series currently shows; drives the update-vs-setData decision. */
  previousData?: readonly IndicatorDataPoint[];
}

interface BandPrimitiveRef {
  primitive: BandPrimitive;
  /** Converted series for this band; reused when only the tail moved. */
  conversion?: BandConversionCacheEntry;
}

interface PaneState {
  pane: IPaneApi<Time>;
  indicatorId: string;
}

export interface BandConversionCacheEntry {
  cacheKey: string;
  source: readonly BandIndicatorDataPoint[];
  converted: UtcDated<BandIndicatorDataPoint>[];
}

const sameBandPoint = (a: BandIndicatorDataPoint, b: BandIndicatorDataPoint): boolean =>
  a.time === b.time && a.upper === b.upper && a.middle === b.middle && a.lower === b.lower;

// Reuse the converted array when the dataset only moved at its tail; a mid-series
// edit, identity change, or dropped timestamps all force a full rebuild.
export const updateBandConversion = (
  cached: BandConversionCacheEntry | undefined,
  cacheKey: string,
  source: readonly BandIndicatorDataPoint[],
): UtcDated<BandIndicatorDataPoint>[] => {
  const rebuild = (): UtcDated<BandIndicatorDataPoint>[] => toUtcTimestamps(source);
  if (cached === undefined || cached.cacheKey !== cacheKey) return rebuild();
  const { converted, source: previous } = cached;
  // Dropped non-finite timestamps break index alignment, so never reuse then.
  if (converted.length !== previous.length) return rebuild();
  const appended = source.length === previous.length + 1;
  if (!appended && source.length !== previous.length) return rebuild();
  const stable = appended ? previous.length : previous.length - 1;
  for (let i = 0; i < stable; i++) {
    const before = previous[i];
    const after = source[i];
    if (before === undefined || after === undefined || !sameBandPoint(before, after)) {
      return rebuild();
    }
  }
  const last = source.at(-1);
  const tail = last === undefined ? undefined : toUtcTimestamps([last])[0];
  if (tail === undefined) return rebuild();
  if (appended) converted.push(tail);
  else converted[converted.length - 1] = tail;
  return converted;
};

const createOscillatorPriceFormat = () => ({
  type: "custom" as const,
  formatter: (price: number) => formatAxis(price),
});

const createLineOptions = (color?: string) => ({
  ...(color !== undefined && { color }),
  lineWidth: 2 as const,
  lastValueVisible: true,
  priceLineVisible: false,
  crosshairMarkerVisible: true,
});

interface OverlaySeriesTarget {
  update: (point: UtcDated<IndicatorDataPoint>) => void;
  setData: (points: UtcDated<IndicatorDataPoint>[]) => void;
}

type OverlaySync = "none" | "update" | "setData";

/**
 * A forming-bar tick only moves the tail, so it can go through `update(last)`.
 * A reshaped dataset (new bar, prepend, param change) still needs `setData`.
 */
const decideOverlaySync = (
  previous: readonly IndicatorDataPoint[] | undefined,
  next: readonly IndicatorDataPoint[],
): OverlaySync => {
  if (previous === undefined) return "setData";
  if (previous === next) return "none";
  if (previous.length !== next.length) return "setData";
  if (next.length === 0) return "none";

  for (let i = 0; i < next.length - 1; i++) {
    const before = previous[i];
    const after = next[i];
    if (
      before === undefined ||
      after === undefined ||
      before.time !== after.time ||
      before.value !== after.value
    ) {
      return "setData";
    }
  }

  const previousLast = previous.at(-1);
  const nextLast = next.at(-1);
  if (previousLast === undefined || nextLast === undefined) return "none";
  if (previousLast.time !== nextLast.time) return "setData";
  return previousLast.value === nextLast.value ? "none" : "update";
};

/** Push indicator points into a chart series, preferring a single tail update. */
export const syncSeriesData = (
  series: OverlaySeriesTarget,
  previous: readonly IndicatorDataPoint[] | undefined,
  next: readonly IndicatorDataPoint[],
): void => {
  const decision = decideOverlaySync(previous, next);
  if (decision === "none") return;

  if (decision === "update") {
    const last = next.at(-1);
    if (last === undefined) return;
    const converted = toUtcTimestamps([last])[0];
    if (converted !== undefined) series.update(converted);
    return;
  }

  series.setData(toUtcTimestamps(next));
};

/** Sync the series and remember what it now shows for the next tick. */
const applyIndicatorData = (ref: IndicatorSeriesRef, data: readonly IndicatorDataPoint[]): void => {
  syncSeriesData(ref.series, ref.previousData, data);
  ref.previousData = data;
};

export const useIndicatorOverlay = ({
  chart,
  mainSeries,
  activeIndicators,
  indicatorData,
}: UseIndicatorOverlayProps): void => {
  const theme = useChartTheme();
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
      if (color !== undefined) seriesRef.series.applyOptions({ color });
      applyIndicatorData(seriesRef, data.data);
    },
    [chart],
  );

  const renderBandOverlay = useCallback(
    (instanceId: string, data: IndicatorRenderEntry, color?: string) => {
      if (data.type !== "band") return;
      let bandRef = bandPrimitiveRefs.current.get(instanceId);
      const bandData = updateBandConversion(bandRef?.conversion, data.meta.cacheKey, data.data);
      const first = bandData[0];
      const last = bandData.at(-1);
      if (first === undefined || last === undefined) return;
      // Only attach the cache once a primitive exists to own it.
      const conversion = { cacheKey: data.meta.cacheKey, source: data.data, converted: bandData };
      const safeColor =
        color !== undefined && color !== "" ? color : theme.colors["--data-crosshair"];

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
        bandRef.conversion = conversion;
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
    [mainSeries, theme],
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
      if (color !== undefined) seriesRef.series.applyOptions({ color });

      applyIndicatorData(seriesRef, data.data);
    },
    [chart],
  );

  useEffect(() => {
    if (chart === null) return;

    const applyKey = (cacheKey: string): string => `${theme.version}:${cacheKey}`;
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
        d === undefined ||
        appliedCacheKeyRef.current.get(indicator.instanceId) !== applyKey(d.meta.cacheKey)
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

    for (const indicator of activeIndicators) {
      if (!indicator.config.overlayOnPrice) continue;

      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);
      const isBand = isBandIndicator(instanceId);

      if (!indicator.visible || data === undefined) {
        removeIndicator(instanceId, isBand);
        continue;
      }

      if (appliedCacheKeyRef.current.get(instanceId) === applyKey(data.meta.cacheKey)) continue;

      const color =
        indicator.color !== undefined && indicator.color !== ""
          ? toRgb(indicator.color)
          : getSeriesColor(instanceId);

      if (isBand) {
        renderBandOverlay(instanceId, data, color);
      } else {
        renderLineOverlay(instanceId, data, color);
      }

      appliedCacheKeyRef.current.set(instanceId, applyKey(data.meta.cacheKey));
    }

    for (const indicator of activeIndicators) {
      if (indicator.config.overlayOnPrice) continue;

      const instanceId = indicator.instanceId;
      const data = indicatorData.get(instanceId);

      if (!indicator.visible || data === undefined) {
        removeOscillator(instanceId);
        continue;
      }

      if (appliedCacheKeyRef.current.get(instanceId) === applyKey(data.meta.cacheKey)) continue;

      const color =
        indicator.color !== undefined && indicator.color !== ""
          ? toRgb(indicator.color)
          : getSeriesColor(instanceId);

      renderOscillator(instanceId, data, color);
      appliedCacheKeyRef.current.set(instanceId, applyKey(data.meta.cacheKey));
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
    theme,
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
};
