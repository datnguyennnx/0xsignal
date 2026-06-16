import type { SeriesMarker, Time } from "lightweight-charts";

// Types

/**
 * Shape of a Hyperliquid user fill / executed trade.
 * Only the fields needed for marker mapping are included.
 *
 * @remarks
 * The `dir` field is essential for buy/sell classification:
 * - "Open Long" / "Close Short" → increasing long exposure → BUY
 * - "Open Short" / "Close Long" → increasing short exposure → SELL
 */
export interface HyperliquidFill {
  readonly coin: string;
  readonly px: string; // price
  readonly sz: string; // size
  readonly side: "A" | "B"; // ask/sell or bid/buy
  readonly time: number; // milliseconds since epoch
  readonly dir: string; // trade direction label
  readonly hash: string;
}

/**
 * A series marker with an explicit numeric time, suitable for attaching
 * to a candlestick series in Lightweight Charts.
 */
export type TradeMarker = SeriesMarker<Time>;

/**
 * Logical representation of a trade for HTML overlay rendering.
 * time + price → pixel coordinates via chart API.
 */
export interface LogicalTradeMarker {
  /** Unique trade identifier (fill hash). */
  id: string;
  /** Epoch seconds, matches candle.time. */
  time: number;
  /** Trade execution price. */
  price: number;
  /** Buy or sell classification. */
  side: "buy" | "sell";
  /** Human-readable direction label, e.g. "Open Long", "Close Short". */
  dir: string;
}

/**
 * A group of trade markers that fall into the same candle bucket.
 */
export interface MarkerGroup {
  /** Candle open time (epoch seconds). */
  time: number;
  /** Markers belonging to this candle, sorted deterministically. */
  items: LogicalTradeMarker[];
}

// Timeframe Helpers

/** Parse "1m", "5h" etc. to seconds. Pure alternative to getIntervalMs. */
export function intervalToSeconds(interval: string): number {
  const value = parseInt(interval, 10);
  const unit = interval.slice(-1) as "m" | "h" | "d" | "w";
  const multipliers: Record<string, number> = {
    m: 60,
    h: 3_600,
    d: 86_400,
    w: 604_800,
  };
  return value * (multipliers[unit] ?? 3_600);
}

/** Floor ms to candle bucket: ms→s, divide by timeframe, floor, multiply back. */
export function normalizeFillToCandleTime(fillTimeMs: number, timeframeSec: number): number {
  const tSec = Math.floor(fillTimeMs / 1000);
  const bucket = Math.floor(tSec / timeframeSec);
  return bucket * timeframeSec;
}

// Buy/Sell Classification

/** True if fill increases long exposure (side=B + Open Long/Close Short). */
export function isBuyFill(fill: HyperliquidFill): boolean {
  return fill.side === "B" && (fill.dir === "Open Long" || fill.dir === "Close Short");
}

// Marker Visuals

const BUY_SHAPE = "circle" as const;
const SELL_SHAPE = "circle" as const;

/**
 * Formats a fill's marker label — brief single character.
 *
 * @param fill - The fill to format.
 * @returns `"B"` for buy, `"S"` for sell.
 */
function formatFillLabel(fill: HyperliquidFill): string {
  return isBuyFill(fill) ? "B" : "S";
}

// Main Pipeline

/**
 * Map fills → LWC series markers.
 *
 * @param fills    - Filtered by currentCoin.
 * @param timeframeSec - Candle bucket size in seconds.
 * @param currentCoin  - Target coin symbol.
 * @param buyColor     - Buy marker color.
 * @param sellColor    - Sell marker color.
 */
export function mapFillsToSeriesMarkers(
  fills: readonly HyperliquidFill[],
  timeframeSec: number,
  currentCoin: string,
  buyColor: string,
  sellColor: string
): TradeMarker[] {
  const markers: TradeMarker[] = [];

  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.coin !== currentCoin) continue;

    const candleTime = normalizeFillToCandleTime(fill.time, timeframeSec);
    const isBuy = isBuyFill(fill);

    markers.push({
      time: candleTime as Time,
      position: isBuy ? "belowBar" : "aboveBar",
      shape: isBuy ? BUY_SHAPE : SELL_SHAPE,
      color: isBuy ? buyColor : sellColor,
      text: formatFillLabel(fill),
    });
  }

  // Sort ascending by time for deterministic marker order.
  markers.sort((a, b) => Number(a.time) - Number(b.time));

  return markers;
}

/** Map fills → LogicalTradeMarker[] for overlay rendering. */
export function mapFillsToLogicalMarkers(
  fills: readonly HyperliquidFill[],
  timeframeSec: number,
  currentCoin: string
): LogicalTradeMarker[] {
  const markers: LogicalTradeMarker[] = [];

  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.coin !== currentCoin) continue;

    markers.push({
      id: fill.hash,
      time: normalizeFillToCandleTime(fill.time, timeframeSec),
      price: Number(fill.px),
      side: isBuyFill(fill) ? "buy" : "sell",
      dir: fill.dir,
    });
  }

  markers.sort((a, b) => a.time - b.time);
  return markers;
}

// Grouping

/** Max markers rendered per candle before collapsing into "+N". */
export const MAX_STACK_PER_CANDLE = 5;

/** Diameter of each trade marker circle in pixels. */
export const MARKER_DIAMETER = 20;

/** Gap between stacked markers in pixels. */
export const MARKER_GAP = 5;

/** Extra offset above candle high before first marker. */
export const MARKER_OFFSET_TOP = 8;

/** Group markers by candle time. Items sorted by id within each group. */
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
    items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    groups.push({ time, items });
  });

  groups.sort((a, b) => a.time - b.time);
  return groups;
}

// Tooltip

/** Tooltip text e.g. "Open Long at 81,000". */
export function buildTooltipText(marker: LogicalTradeMarker): string {
  const price = Number(marker.price);
  const formattedPrice = Number.isInteger(price)
    ? price.toLocaleString("en-US")
    : price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      });
  return `${marker.dir} at ${formattedPrice}`;
}
