import type { ChartDataPoint } from "@0xsignal/shared";

import { formatPrice } from "@/core/utils/formatters";

/**
 * Shape of a Hyperliquid user fill / executed trade.
 * Only the fields needed for marker mapping are included.
 *
 * The `dir` field is essential for buy/sell classification:
 * - "Open Long" / "Close Short" → increasing long exposure → BUY
 * - "Open Short" / "Close Long" → increasing short exposure → SELL
 */
export interface HyperliquidFill {
  readonly coin: string;
  readonly px: string;
  readonly sz: string;
  readonly side: "A" | "B";
  readonly time: number;
  readonly dir: string;
  readonly hash: string;
  /** Unique per-fill id; `hash` repeats for every fill of one transaction. */
  readonly tid: number;
}

/**
 * Logical representation of a trade for HTML overlay rendering.
 * time + price → pixel coordinates via chart API.
 */
export interface LogicalTradeMarker {
  id: string;
  time: number;
  price: number;
  side: "buy" | "sell";
  dir: string;
}

/**
 * A group of trade markers that fall into the same candle bucket.
 */
export interface MarkerGroup {
  time: number;
  items: LogicalTradeMarker[];
}

export function intervalToSeconds(interval: string): number {
  const value = Math.trunc(Number(interval.replaceAll(/[^\d.-]/g, "")));
  const unit = interval.slice(-1);
  const multipliers: Record<string, number> = {
    m: 60,
    h: 3_600,
    d: 86_400,
    w: 604_800,
  };
  return value * (multipliers[unit] ?? 3_600);
}

/** Floor ms to candle bucket: ms→s, divide by timeframe, floor, multiply back. */
function normalizeFillToCandleTime(fillTimeMs: number, timeframeSec: number): number {
  const tSec = Math.floor(fillTimeMs / 1000);
  const bucket = Math.floor(tSec / timeframeSec);
  return bucket * timeframeSec;
}

function isBuyFill(fill: HyperliquidFill): boolean {
  return fill.side === "B" && (fill.dir === "Open Long" || fill.dir === "Close Short");
}

/**
 * Upper bound on the fills handed to the marker mapper. Only fills inside the
 * loaded candle window can ever be painted, and a long session accumulates far
 * more history than the chart shows.
 */
const MAX_MARKER_FILLS = 500;

export interface MarkerFillWindow {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * The fill window implied by the loaded candles, over the scalars a memo can
 * compare. Candle times are seconds; fill times are milliseconds. Include the
 * forming bar by ending one candle width past the last open time.
 *
 * Kept separate from `selectMarkerFills` so a candle tick that leaves the window
 * unchanged does not invalidate the fill/marker memo.
 */
export function markerFillWindow(
  candles: readonly ChartDataPoint[],
  timeframeSec: number,
): MarkerFillWindow | null {
  const first = candles[0];
  const last = candles.at(-1);
  if (first === undefined || last === undefined) return null;
  return { startMs: first.time * 1000, endMs: (last.time + timeframeSec) * 1000 };
}

/**
 * Drops fills outside the given window, then keeps the latest
 * `MAX_MARKER_FILLS` newest-first. The result is safe to pass to
 * `mapFillsToLogicalMarkers`, which copies and sorts its whole input.
 */
export function selectMarkerFillsInWindow(
  fills: readonly HyperliquidFill[],
  window: MarkerFillWindow | null,
): HyperliquidFill[] {
  if (fills.length === 0 || window === null) return [];

  const inWindow: HyperliquidFill[] = [];
  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.time < window.startMs || fill.time >= window.endMs) continue;
    inWindow.push(fill);
  }

  // The merged cache is already newest-first, but the REST seed is not
  // guaranteed to be, so order explicitly before slicing.
  inWindow.sort((a, b) => b.time - a.time);
  return inWindow.slice(0, MAX_MARKER_FILLS);
}

export function mapFillsToLogicalMarkers(
  fills: readonly HyperliquidFill[],
  timeframeSec: number,
  currentCoin: string,
): LogicalTradeMarker[] {
  const markers: LogicalTradeMarker[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.coin !== currentCoin) continue;
    if (seen.has(fill.tid)) continue;
    seen.add(fill.tid);

    markers.push({
      id: String(fill.tid),
      time: normalizeFillToCandleTime(fill.time, timeframeSec),
      price: Number(fill.px),
      side: isBuyFill(fill) ? "buy" : "sell",
      dir: fill.dir,
    });
  }

  markers.sort((a, b) => a.time - b.time);
  return markers;
}

export const MAX_STACK_PER_CANDLE = 5 as const;

/**
 * Pixel geometry for the marker overlay, derived from the fluid root font size
 * so it tracks the 16px@1080p → 24px@4K scale instead of freezing at 1080p.
 */
export interface MarkerMetrics {
  readonly markerDiameter: number;
  readonly markerGap: number;
  /** Gap between the candle high and the bottom edge of the first bubble. */
  readonly markerOffsetTop: number;
  /** Gap between the top of the bubble stack and the tooltip box. */
  readonly tooltipGap: number;
  /** Tooltip box height (0.875rem × line-height 1.4 + padding), rounded up. */
  readonly tooltipHeight: number;
  /** Half the widest tooltip ("Close Short at $123,456.78") at the max font size. */
  readonly tooltipHalfWidth: number;
  /** Breathing room between the tooltip and the edge of the plot. */
  readonly overlayEdgePad: number;
}

export function getMarkerMetrics(rootFontSizePx: number): MarkerMetrics {
  const toPx = (rem: number): number => rem * rootFontSizePx;
  return {
    markerDiameter: toPx(1.25),
    markerGap: toPx(0.3125),
    markerOffsetTop: toPx(0.5),
    tooltipGap: toPx(0.375),
    tooltipHeight: toPx(2),
    tooltipHalfWidth: toPx(6.25),
    overlayEdgePad: toPx(0.25),
  };
}

export function groupMarkersByCandle(markers: readonly LogicalTradeMarker[]): MarkerGroup[] {
  const map = new Map<number, LogicalTradeMarker[]>();

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    let bucket = map.get(m.time);
    if (!bucket) {
      bucket = [];
      map.set(m.time, bucket);
    }
    bucket.push(m);
  }

  const groups: MarkerGroup[] = [];
  map.forEach((items, time) => {
    // Lowest price first: the stack grows upward from the candle high, so the
    // lowest fill sits nearest the wick; id breaks price ties for stability.
    items.sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    groups.push({ time, items });
  });

  groups.sort((a, b) => a.time - b.time);
  return groups;
}

/** Tooltip text e.g. "Open Long at $81,000.00". */
export function buildTooltipText(marker: LogicalTradeMarker): string {
  return `${marker.dir} at ${formatPrice(marker.price)}`;
}
