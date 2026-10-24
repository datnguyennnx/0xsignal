import { useState, useEffect, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { ChartDataPoint } from "@0xsignal/shared";
import { getRootFontSizePx, subscribeRootFontSize } from "@/core/utils/rem";
import { isUtcTimestamp } from "../lib/time";
import {
  groupMarkersByCandle,
  buildTooltipText,
  getMarkerMetrics,
  MAX_STACK_PER_CANDLE,
  type MarkerMetrics,
  type LogicalTradeMarker,
  type MarkerGroup,
} from "@/features/trade/utils/trade-markers";

interface TradeMarkersOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  markers: readonly LogicalTradeMarker[];
  candles: readonly ChartDataPoint[];
}

type TooltipPlacement = "above" | "right" | "left";

interface OverlayPoint {
  /** Unique per rendered bubble: fill id scoped to its candle bucket (or the bucket chip). */
  key: string;
  id: string;
  x: number;
  y: number;
  side: "buy" | "sell";
  tooltip: string;
  /** If true, render as a "+N" summary marker. */
  isOverflow?: boolean;
  overflowCount?: number;
  /** Tooltip anchor; identical for every bubble of one group. */
  tipX: number;
  tipY: number;
  tipPlacement: TooltipPlacement;
}

/** A bubble's vertical slot before the group's tooltip anchor is known. */
interface StackEntry {
  key: string;
  id: string;
  y: number;
  side: "buy" | "sell";
  tooltip: string;
  isOverflow?: boolean;
  overflowCount?: number;
}

const TOOLTIP_PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  above: "-translate-x-1/2 -translate-y-full",
  right: "-translate-y-1/2",
  left: "-translate-x-full -translate-y-1/2",
};

const clamp = (value: number, min: number, max: number): number =>
  max < min ? (min + max) / 2 : Math.min(Math.max(value, min), max);

/**
 * Tooltip goes above the topmost bubble; it flips beside the stack only when the
 * plot's top edge is too close, so it never drops onto the candle it describes.
 */
function placeTooltip(
  x: number,
  stackTopY: number,
  pane: { readonly width: number; readonly height: number },
  metrics: MarkerMetrics,
): { tipX: number; tipY: number; tipPlacement: TooltipPlacement } {
  const radius = metrics.markerDiameter / 2;
  const centerX = clamp(
    x,
    metrics.overlayEdgePad + metrics.tooltipHalfWidth,
    pane.width - metrics.overlayEdgePad - metrics.tooltipHalfWidth,
  );
  const aboveY = stackTopY - radius - metrics.tooltipGap;

  if (aboveY - metrics.tooltipHeight >= metrics.overlayEdgePad) {
    return { tipX: centerX, tipY: aboveY, tipPlacement: "above" };
  }

  const sideY = clamp(
    stackTopY,
    metrics.overlayEdgePad + metrics.tooltipHeight / 2,
    pane.height - metrics.overlayEdgePad - metrics.tooltipHeight / 2,
  );
  const rightX = x + radius + metrics.tooltipGap;
  if (rightX + metrics.tooltipHalfWidth * 2 <= pane.width - metrics.overlayEdgePad) {
    return { tipX: rightX, tipY: sideY, tipPlacement: "right" };
  }
  const leftX = x - radius - metrics.tooltipGap;
  if (leftX - metrics.tooltipHalfWidth * 2 >= metrics.overlayEdgePad) {
    return { tipX: leftX, tipY: sideY, tipPlacement: "left" };
  }
  // No room beside the stack either: pin to the plot's top edge, still above the candle.
  return {
    tipX: centerX,
    tipY: metrics.overlayEdgePad + metrics.tooltipHeight,
    tipPlacement: "above",
  };
}

/** Positions every marker for the current viewport. Pure: same inputs, same pixels. */
function buildPoints(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  groups: readonly MarkerGroup[],
  candleMap: Map<number, ChartDataPoint>,
  metrics: MarkerMetrics,
): OverlayPoint[] {
  const radius = metrics.markerDiameter / 2;
  const step = metrics.markerDiameter + metrics.markerGap;
  const ts = chart.timeScale();
  const visibleRange = ts.getVisibleRange();
  const pane = chart.paneSize();
  const result: OverlayPoint[] = [];

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!isUtcTimestamp(group.time)) continue;

    // Cull markers outside the visible range.
    if (
      visibleRange &&
      (group.time < Number(visibleRange.from) || group.time > Number(visibleRange.to))
    ) {
      continue;
    }

    const x = ts.timeToCoordinate(group.time);
    if (x === null) continue;

    const items = group.items;
    const hasOverflow = items.length > MAX_STACK_PER_CANDLE;
    const individualCount = hasOverflow ? MAX_STACK_PER_CANDLE - 1 : items.length;

    // The bubble column hangs off the candle high, not off the fill price.
    const candle = candleMap.get(group.time);
    const highY = candle === undefined ? null : series.priceToCoordinate(candle.high);

    const stack: StackEntry[] = [];
    for (let i = 0; i < individualCount; i++) {
      const m = items[i];
      let y: number;
      if (highY === null) {
        // No candle loaded for this bucket (fill outside the fetched history):
        // stay on the fill price, and drop the marker if that has no coordinate.
        const fillY = series.priceToCoordinate(m.price);
        if (fillY === null) continue;
        y = fillY - radius - metrics.markerOffsetTop;
        while (stack.some((entry) => Math.abs(entry.y - y) < step)) y -= step;
      } else {
        y = highY - radius - metrics.markerOffsetTop - stack.length * step;
      }
      stack.push({
        key: `${group.time}:${m.id}`,
        id: m.id,
        y,
        side: m.side,
        tooltip: buildTooltipText(m),
      });
    }

    if (stack.length === 0) continue;

    let stackTopY = stack[0].y;
    for (let i = 1; i < stack.length; i++) {
      if (stack[i].y < stackTopY) stackTopY = stack[i].y;
    }

    if (hasOverflow) {
      const overflowCount = items.length - individualCount;
      stackTopY -= step;
      stack.push({
        key: `overflow:${group.time}`,
        id: `overflow-${group.time}`,
        y: stackTopY,
        side: "buy",
        tooltip: `+${overflowCount} more trades`,
        isOverflow: true,
        overflowCount,
      });
    }

    const tip = placeTooltip(x, stackTopY, pane, metrics);
    for (let i = 0; i < stack.length; i++) {
      result.push({ ...stack[i], x, ...tip });
    }
  }

  return result;
}

const pointsEqual = (a: readonly OverlayPoint[], b: readonly OverlayPoint[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      left.key !== right.key ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.side !== right.side ||
      left.tooltip !== right.tooltip ||
      left.isOverflow !== right.isOverflow ||
      left.overflowCount !== right.overflowCount ||
      left.tipX !== right.tipX ||
      left.tipY !== right.tipY ||
      left.tipPlacement !== right.tipPlacement
    )
      return false;
  }
  return true;
};

export function TradeMarkersOverlay({ chart, series, markers, candles }: TradeMarkersOverlayProps) {
  const [points, setPoints] = useState<OverlayPoint[]>([]);
  const [hovered, setHovered] = useState<OverlayPoint | null>(null);

  // Root font size is fluid (16px → 24px); re-read it when the viewport changes
  // so the bubble/tooltip geometry scales with the rest of the UI.
  const [rootFontSizePx, setRootFontSizePx] = useState(getRootFontSizePx);
  useEffect(() => {
    const unsubscribe = subscribeRootFontSize(() => {
      setRootFontSizePx(getRootFontSizePx());
    });
    return unsubscribe;
  }, []);
  const metrics = useMemo(() => getMarkerMetrics(rootFontSizePx), [rootFontSizePx]);
  const markerSizeStyle = useMemo<CSSProperties>(
    () =>
      ({
        width: metrics.markerDiameter,
        height: metrics.markerDiameter,
        "--hl-marker-size": `${metrics.markerDiameter}px`,
      }) as CSSProperties,
    [metrics],
  );

  // Rebuilt only when the candle dataset identity changes (a tick), never on pan/zoom.
  const candleMap = useMemo(() => {
    const map = new Map<number, ChartDataPoint>();
    for (let i = 0; i < candles.length; i++) {
      map.set(candles[i].time, candles[i]);
    }
    return map;
  }, [candles]);

  // Grouping is pure marker data; viewport events must not redo it.
  const groups = useMemo(() => groupMarkersByCandle(markers), [markers]);

  const recalc = useCallback(() => {
    if (chart === null || series === null) return;
    const result = buildPoints(chart, series, groups, candleMap, metrics);
    setPoints((previous) => (pointsEqual(previous, result) ? previous : result));
  }, [chart, series, groups, candleMap, metrics]);

  // Recalc on data change + subscribe to viewport/size events.
  useEffect(() => {
    if (chart === null || series === null) return () => {};

    let disposed = false;
    let frame = 0;

    // Three timeScale events fire per pan/zoom gesture; fold them into one
    // recompute per painted frame.
    const scheduleRecalc = () => {
      if (disposed || frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!disposed) recalc();
      });
    };

    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(scheduleRecalc);
    ts.subscribeVisibleLogicalRangeChange(scheduleRecalc);
    ts.subscribeSizeChange(scheduleRecalc);

    // Place the first point set on the next painted frame as well, so a burst of
    // viewport events during mount still collapses into a single recompute.
    scheduleRecalc();

    return () => {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      ts.unsubscribeVisibleTimeRangeChange(scheduleRecalc);
      ts.unsubscribeVisibleLogicalRangeChange(scheduleRecalc);
      ts.unsubscribeSizeChange(scheduleRecalc);
    };
  }, [chart, series, recalc]);

  // Derive tooltip from the live point set: hide if the hovered marker is gone,
  // and follow its current geometry while the viewport moves.
  const visibleHovered =
    hovered === null ? null : (points.find((p) => p.key === hovered.key) ?? null);

  if (points.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {points.map((p) => (
        <div
          key={p.key}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: p.x, top: p.y }}
          onMouseEnter={() => {
            setHovered(p);
          }}
          onMouseLeave={() => {
            setHovered(null);
          }}
        >
          {p.isOverflow === true ? (
            <div className="hl-trade-marker hl-trade-marker--overflow" style={markerSizeStyle}>
              +{p.overflowCount}
            </div>
          ) : (
            <div
              className={
                "hl-trade-marker" +
                (p.side === "buy" ? " hl-trade-marker--buy" : " hl-trade-marker--sell")
              }
              style={markerSizeStyle}
            >
              {p.side === "buy" ? "B" : "S"}
            </div>
          )}
        </div>
      ))}

      {visibleHovered && (
        <div
          className={
            "hl-trade-tooltip absolute! " + TOOLTIP_PLACEMENT_CLASS[visibleHovered.tipPlacement]
          }
          style={{ left: visibleHovered.tipX, top: visibleHovered.tipY }}
        >
          {visibleHovered.tooltip}
        </div>
      )}
    </div>
  );
}
