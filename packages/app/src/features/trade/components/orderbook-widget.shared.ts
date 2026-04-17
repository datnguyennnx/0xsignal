import type { OrderbookData, OrderbookLevel } from "@/core/utils/hyperliquid";

interface ScalingOptionLike {
  value: number;
}

export interface PriceScalingState {
  symbol: string;
  value: number;
}

export function getEffectivePriceScaling(
  userPriceScaling: PriceScalingState | null,
  symbol: string,
  scalingOptions: ScalingOptionLike[]
): number {
  if (userPriceScaling?.symbol === symbol) {
    return userPriceScaling.value;
  }
  return scalingOptions.length > 0 ? scalingOptions[0].value : 0;
}

export function mapVisibleOrderbookLevels<TLevel>(
  orderbook: OrderbookData | null,
  visibleRows: number,
  mapLevel: (level: OrderbookLevel) => TLevel
): {
  visibleAsks: TLevel[];
  visibleBids: TLevel[];
  maxTotal: number;
} {
  if (!orderbook) {
    return { visibleAsks: [], visibleBids: [], maxTotal: 0 };
  }

  const asks = orderbook.asks.slice(0, visibleRows);
  const bids = orderbook.bids.slice(0, visibleRows);

  let maxTotal = 0;
  for (let i = 0; i < asks.length; i++) maxTotal = Math.max(maxTotal, asks[i].total);
  for (let i = 0; i < bids.length; i++) maxTotal = Math.max(maxTotal, bids[i].total);

  return {
    visibleAsks: asks.map(mapLevel),
    visibleBids: bids.map(mapLevel),
    maxTotal,
  };
}
