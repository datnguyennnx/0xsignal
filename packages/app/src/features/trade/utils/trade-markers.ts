import type { SeriesMarker, Time } from "lightweight-charts";

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
}

export type TradeMarker = SeriesMarker<Time>;

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

export function isBuyFill(fill: HyperliquidFill): boolean {
  return fill.side === "B" && (fill.dir === "Open Long" || fill.dir === "Close Short");
}

const BUY_SHAPE = "circle" as const;
const SELL_SHAPE = "circle" as const;

function formatFillLabel(fill: HyperliquidFill): string {
  return isBuyFill(fill) ? "B" : "S";
}

export function mapFillsToSeriesMarkers(
  fills: readonly HyperliquidFill[],
  timeframeSec: number,
  currentCoin: string,
  buyColor: string,
  sellColor: string,
): TradeMarker[] {
  const markers: TradeMarker[] = [];

  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.coin !== currentCoin) continue;

    const candleTime = normalizeFillToCandleTime(fill.time, timeframeSec);
    const isBuy = isBuyFill(fill);

    markers.push({
      time: candleTime as Time, // safe: lightweight-charts branded type, candleTime is epoch seconds
      position: isBuy ? "belowBar" : "aboveBar",
      shape: isBuy ? BUY_SHAPE : SELL_SHAPE,
      color: isBuy ? buyColor : sellColor,
      text: formatFillLabel(fill),
    });
  }

  markers.sort((a, b) => Number(a.time) - Number(b.time));

  return markers;
}

export function mapFillsToLogicalMarkers(
  fills: readonly HyperliquidFill[],
  timeframeSec: number,
  currentCoin: string,
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

export const MAX_STACK_PER_CANDLE = 5;
export const MARKER_DIAMETER = 20;
export const MARKER_GAP = 5;
export const MARKER_OFFSET_TOP = 8;

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
