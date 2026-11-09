/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { hyperliquidSymbolLogoQueryOptions } from "./use-hyperliquid-symbol-logo";
import { tradeAnnotationQueryOptions } from "./use-trade-annotation";

describe("long-lived asset metadata queries", () => {
  test("the logo probe keeps its 24h window and skips reconnect refetches", () => {
    const options = hyperliquidSymbolLogoQueryOptions("BTC");

    expect(options.staleTime).toBe(24 * 60 * 60 * 1000);
    expect(options.gcTime).toBe(24 * 60 * 60 * 1000);
    expect(options.refetchOnReconnect).toBe(false);
  });

  test("trade annotations keep their hour-scale window and skip reconnect refetches", () => {
    const options = tradeAnnotationQueryOptions("BTC");

    expect(options.staleTime).toBe(60 * 60 * 1000);
    expect(options.gcTime).toBe(24 * 60 * 60 * 1000);
    expect(options.refetchOnReconnect).toBe(false);
  });
});
