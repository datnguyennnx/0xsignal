import { useState, useEffect, useCallback } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { ChartDataPoint } from "@0xsignal/shared";
import {
  groupMarkersByCandle,
  buildTooltipText,
  MAX_STACK_PER_CANDLE,
  MARKER_DIAMETER,
  MARKER_GAP,
  MARKER_OFFSET_TOP,
  type LogicalTradeMarker,
} from "@/features/trade/utils/trade-markers";

interface TradeMarkersOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  markers: readonly LogicalTradeMarker[];
  candles: readonly ChartDataPoint[];
}

interface OverlayPoint {
  id: string;
  x: number;
  y: number;
  side: "buy" | "sell";
  tooltip: string;
  /** If true, render as a "+N" summary marker. */
  isOverflow?: boolean;
  overflowCount?: number;
}

const RADIUS = MARKER_DIAMETER / 2;
const STEP = MARKER_DIAMETER + MARKER_GAP;

export function TradeMarkersOverlay({ chart, series, markers, candles }: TradeMarkersOverlayProps) {
  const [points, setPoints] = useState<OverlayPoint[]>([]);
  const [hovered, setHovered] = useState<OverlayPoint | null>(null);

  const recalc = useCallback(() => {
    if (!chart || !series) return;

    const ts = chart.timeScale();
    const visibleRange = ts.getVisibleRange();
    const candleMap = new Map<number, ChartDataPoint>();
    for (let i = 0; i < candles.length; i++) {
      candleMap.set(candles[i].time, candles[i]);
    }

    const groups = groupMarkersByCandle(markers);
    const result: OverlayPoint[] = [];

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const candle = candleMap.get(group.time);
      if (!candle) continue;

      // Cull markers outside the visible range.
      if (
        visibleRange &&
        (group.time < Number(visibleRange.from) || group.time > Number(visibleRange.to))
      ) {
        continue;
      }

      const x = ts.timeToCoordinate(group.time as Time); // safe: lightweight-charts branded type
      const baseY = series.priceToCoordinate(candle.high);
      if (x === null || baseY === null) continue;

      const items = group.items;
      const hasOverflow = items.length > MAX_STACK_PER_CANDLE;
      const individualCount = hasOverflow ? MAX_STACK_PER_CANDLE - 1 : items.length;

      for (let i = 0; i < individualCount; i++) {
        const m = items[i];
        const y = baseY - RADIUS - MARKER_OFFSET_TOP - i * STEP;
        result.push({
          id: m.id,
          x,
          y,
          side: m.side,
          tooltip: buildTooltipText(m),
        });
      }

      if (hasOverflow) {
        const overflowCount = items.length - individualCount;
        const y = baseY - RADIUS - MARKER_OFFSET_TOP - individualCount * STEP;
        result.push({
          id: `overflow-${group.time}`,
          x,
          y,
          side: "buy" as const,
          tooltip: `+${overflowCount} more trades`,
          isOverflow: true,
          overflowCount,
        });
      }
    }

    setPoints(result);
  }, [chart, series, markers, candles]);

  // Recalc on data change + subscribe to viewport/size events.
  useEffect(() => {
    if (!chart || !series) return;

    let disposed = false;

    const safeRecalc = () => {
      if (disposed) return;
      recalc();
    };

    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(safeRecalc);
    ts.subscribeVisibleLogicalRangeChange(safeRecalc);
    ts.subscribeSizeChange(safeRecalc);

    safeRecalc();

    return () => {
      disposed = true;
      ts.unsubscribeVisibleTimeRangeChange(safeRecalc);
      ts.unsubscribeVisibleLogicalRangeChange(safeRecalc);
      ts.unsubscribeSizeChange(safeRecalc);
    };
  }, [chart, series, recalc]);

  // Derive tooltip: hide if the hovered marker no longer exists.
  const visibleHovered = hovered && points.some((p) => p.id === hovered.id) ? hovered : null;

  if (points.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {points.map((p, idx) => (
        <div
          key={`${p.id}-${idx}`}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            transform: "translate(-50%, -50%)",
          }}
          className="pointer-events-auto"
          onMouseEnter={() => setHovered(p)}
          onMouseLeave={() => setHovered(null)}
        >
          {p.isOverflow ? (
            <div className="hl-trade-marker hl-trade-marker--overflow">+{p.overflowCount}</div>
          ) : (
            <div
              className={
                "hl-trade-marker" +
                (p.side === "buy" ? " hl-trade-marker--buy" : " hl-trade-marker--sell")
              }
            >
              {p.side === "buy" ? "B" : "S"}
            </div>
          )}
        </div>
      ))}

      {visibleHovered && (
        <div
          className="hl-trade-tooltip"
          style={{
            position: "absolute",
            left: visibleHovered.x,
            top: visibleHovered.y,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
        >
          {visibleHovered.tooltip}
        </div>
      )}
    </div>
  );
}
