/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { mapToHLInterval } from "../core/utils/hyperliquid";
import { CHART_CANDLE_LIMIT } from "../features/trade/lib/candle-limit";
import { normalizeSymbol } from "../features/trade/lib/symbol";

import { candlePrefetchTarget } from "./preload-routes";
import { queryKeys } from "./query-keys";

describe("candlePrefetchTarget", () => {
  test("the prefetch key is exactly the key the chart hook reads", () => {
    const target = candlePrefetchTarget("BTC");

    // The chart hook builds its key from the same shared limit constant.
    const chartKey = queryKeys.market.candles(
      normalizeSymbol("BTC"),
      mapToHLInterval("1h"),
      CHART_CANDLE_LIMIT,
    );

    expect(target.queryKey).toEqual(chartKey);
    expect(target.limit).toBe(CHART_CANDLE_LIMIT);
  });

  test("the shared limit is the chart's 250-bar window", () => {
    expect(CHART_CANDLE_LIMIT).toBe(250);
    expect(candlePrefetchTarget("PURR/USDC").queryKey[4]).toBe(CHART_CANDLE_LIMIT);
  });
});
