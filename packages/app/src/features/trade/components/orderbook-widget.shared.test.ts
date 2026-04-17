import { describe, expect, it } from "vitest";
import {
  getEffectivePriceScaling,
  mapVisibleOrderbookLevels,
  type PriceScalingState,
} from "./orderbook-widget.shared";
import type { OrderbookData } from "@/core/utils/hyperliquid";

describe("orderbook-widget shared helpers", () => {
  it("uses user scaling for matching symbol", () => {
    const scaling: PriceScalingState = { symbol: "btc", value: 4 };
    const result = getEffectivePriceScaling(scaling, "btc", [{ value: 2 }]);
    expect(result).toBe(4);
  });

  it("falls back to first option when symbol differs", () => {
    const scaling: PriceScalingState = { symbol: "eth", value: 5 };
    const result = getEffectivePriceScaling(scaling, "btc", [{ value: 3 }, { value: 2 }]);
    expect(result).toBe(3);
  });

  it("maps visible levels and computes max cumulative total", () => {
    const orderbook: OrderbookData = {
      bids: [
        { price: 99, size: 1, total: 1, depth: 10 },
        { price: 98, size: 2, total: 3, depth: 30 },
        { price: 97, size: 2, total: 5, depth: 50 },
      ],
      asks: [
        { price: 101, size: 1.5, total: 1.5, depth: 15 },
        { price: 102, size: 2.5, total: 4, depth: 40 },
        { price: 103, size: 3, total: 7, depth: 70 },
      ],
      spread: 2,
      spreadPercent: 2.02,
      midPrice: 100,
    };

    const result = mapVisibleOrderbookLevels(orderbook, 2, (level) => level.price);

    expect(result.visibleBids).toEqual([99, 98]);
    expect(result.visibleAsks).toEqual([101, 102]);
    expect(result.maxTotal).toBe(4);
  });
});
