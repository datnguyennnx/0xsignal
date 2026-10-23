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

export const MAX_STACK_PER_CANDLE = 5;
export const MARKER_DIAMETER = 20;
export const MARKER_GAP = 5;
/** Pixel gap between the candle high and the bottom edge of the first bubble. */
export const MARKER_OFFSET_TOP = 8;

/** Pixel gap between the top of the bubble stack and the tooltip box. */
export const TOOLTIP_GAP = 6;
/** Tooltip box height (14px × line-height 1.4 + 10px padding), rounded up. */
export const TOOLTIP_HEIGHT = 32;
/** Half the widest tooltip ("Close Short at $123,456.78") at the max font size. */
export const TOOLTIP_HALF_WIDTH = 100;
/** Breathing room between the tooltip and the edge of the plot, in px. */
export const OVERLAY_EDGE_PAD = 4;

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
