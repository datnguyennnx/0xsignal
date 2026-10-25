/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import type { AggregatedMarket } from "@0xsignal/shared";

import { buildLeverageAction } from "../../../services/exchange/client";
import { buildAssetIndexMap, resolveAssetIndex } from "./asset-index";

const market = (coin: string, assetId: number): AggregatedMarket => ({
  coin,
  rawCoin: coin,
  displaySymbol: `${coin}-USD`,
  dexPrefix: null,
  isHip3: false,
  quoteCurrency: "USD",
  name: coin,
  category: "crypto",
  displayCategory: "Crypto",
  isDelisted: false,
  dex: "HYPERLIQUID",
  assetId,
  marketType: "perp",
  markPx: "0",
  prevDayPx: "0",
  openInterest: "0",
  funding: "0",
  dayNtlVlm: "0",
  maxLeverage: 50,
  szDecimals: 4,
});

const map = buildAssetIndexMap([market("BTC", 0), market("ETH", 1)]);

describe("asset index resolution", () => {
  test("resolves a non-BTC symbol to its real index", () => {
    expect(resolveAssetIndex(map, "ETH")).toBe(1);
  });

  test("the signed updateLeverage action carries that index, never BTC's 0", () => {
    const index = Number(resolveAssetIndex(map, "ETH"));
    const action = buildLeverageAction({ asset: index, isCross: true, leverage: 10 });
    expect(index).toBe(1);
    expect(action.asset).toBe(1);
    expect(action.asset).not.toBe(0);
  });

  test("unknown symbols resolve to null instead of defaulting to BTC", () => {
    expect(resolveAssetIndex(map, "SOL")).toBeNull();
  });
});
