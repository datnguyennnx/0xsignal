/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { AggregatedMarket } from "@0xsignal/shared";

import {
  buildPrecisionMap,
  DEFAULT_PRECISION,
  lookupPrecision,
} from "../hooks/use-hyperliquid-meta";
import { selectListedAssets } from "../hooks/use-trade-list";
import { calculatePxDecimals } from "../utils/trade-formatters";

const market = (overrides: Partial<AggregatedMarket> = {}): AggregatedMarket => ({
  coin: "BTC",
  rawCoin: "BTC",
  displaySymbol: "BTC-USDC",
  dexPrefix: null,
  isHip3: false,
  quoteCurrency: "USDC",
  name: "BTC",
  category: "crypto",
  displayCategory: "Crypto",
  isDelisted: false,
  dex: "",
  assetId: 0,
  marketType: "perp",
  markPx: "100",
  prevDayPx: "100",
  openInterest: "0",
  funding: "0",
  dayNtlVlm: "1000000",
  maxLeverage: 10,
  szDecimals: 4,
  ...overrides,
});

const coins = (rows: readonly AggregatedMarket[]): string[] => rows.map((row) => row.coin);

describe("shared market list select", () => {
  test("the select drops a delisted row even when it has volume", () => {
    const payload = [
      market({ coin: "BTC" }),
      market({ coin: "OLD", isDelisted: true, dayNtlVlm: "999999" }),
    ];

    expect(coins(selectListedAssets(payload).assets)).toEqual(["BTC"]);
  });

  test("the select keeps a zero-volume row because liveness is the dropdown's concern", () => {
    const payload = [market({ coin: "BTC" }), market({ coin: "DEAD", dayNtlVlm: "0.0" })];

    expect(coins(selectListedAssets(payload).assets)).toEqual(["BTC", "DEAD"]);
  });
});

describe("builder-dex precision", () => {
  test("a builder-dex lookup returns the parsed value instead of the default", () => {
    const map = buildPrecisionMap([
      market({
        coin: "YEETI",
        rawCoin: "xyz:YEETI",
        dexPrefix: "xyz",
        isHip3: true,
        szDecimals: 2,
        maxLeverage: 20,
      }),
    ]);

    const precision = lookupPrecision(map, "xyz:YEETI");

    expect(precision).toEqual({
      pxDecimals: calculatePxDecimals(2),
      szDecimals: 2,
      maxLeverage: 20,
    });
    expect(precision).not.toEqual(DEFAULT_PRECISION);
  });
});
