/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { MarketPrice } from "@/services/api";

import { resolveAssetView } from "./asset-detail-view";

const ticker = (overrides: Partial<MarketPrice>): MarketPrice => ({
  symbol: "BTC",
  price: 0,
  change24h: 0,
  volume24h: 0,
  openInterest: 0,
  funding: 0,
  markPx: 0,
  midPx: 0,
  prevDayPx: 0,
  timestamp: new Date(0),
  ...overrides,
});

// A pending ticker yields `undefined` data; that must not become the skeleton or
// the error page, or the asset page waits behind one request again.
describe("asset-detail render guard", () => {
  test("paints from the route params while the ticker has not resolved", () => {
    const view = resolveAssetView("BTC");

    expect(view).not.toBeNull();
    expect(view?.symbol).toBe("BTC");
    expect(view?.price.price).toBe(0);
    expect(view?.price.markPx).toBe(0);
  });

  test("keeps the route identity and takes the ticker price once it lands", () => {
    const resolved = ticker({ price: 104_250, markPx: 104_300, change24h: 1.4 });

    expect(resolveAssetView("BTC", resolved)?.price).toBe(resolved);
    expect(resolveAssetView("BTC", resolved)?.symbol).toBe("BTC");
  });

  test("still reports no view when the route carries no symbol", () => {
    expect(resolveAssetView("")).toBeNull();
    expect(resolveAssetView("", ticker({}))).toBeNull();
  });
});
