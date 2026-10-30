/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { AggregatedMarket } from "@0xsignal/shared";

import {
  buildPrecisionMap,
  DEFAULT_PRECISION,
  lookupPrecision,
} from "../hooks/use-hyperliquid-meta";
import { selectListedAssets } from "../hooks/use-trade-list";
import { filterTradeAssets, isLiveMarket } from "../utils/trade-dropdown";
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

const CRYPTO = market({ coin: "BTC" });
const PREIPO = market({
  coin: "SPACEX",
  rawCoin: "SPACEX",
  displaySymbol: "SPACEX-USDC",
  name: "SPACEX",
  category: "preipo",
  displayCategory: "Preipo",
  assetId: 1,
});

describe("asset dropdown tabs", () => {
  test("the Pre-launch tab returns the markets the API categorises as preipo", () => {
    expect(coins(filterTradeAssets([CRYPTO, PREIPO], "prelaunch", ""))).toEqual(["SPACEX"]);
  });

  test("every other tab still compares the tab id against the category", () => {
    expect(coins(filterTradeAssets([CRYPTO, PREIPO], "crypto", ""))).toEqual(["BTC"]);
  });
});

describe("asset dropdown search", () => {
  const spotAtOne = market({
    coin: "@1",
    rawCoin: "@1",
    displaySymbol: "PURR/USDC",
    name: "PURR/USDC",
    marketType: "spot",
    category: "spot",
    assetId: 2,
  });
  const hype = market({
    coin: "HYPE",
    rawCoin: "HYPE",
    displaySymbol: "HYPE-USDC",
    name: "HYPE",
    assetId: 3,
  });
  const assets = [spotAtOne, hype];

  test("search matches the raw wire identifier @1", () => {
    expect(coins(filterTradeAssets(assets, "all", "@1"))).toEqual(["@1"]);
  });

  test("search matches the pair name PURR/USDC", () => {
    expect(coins(filterTradeAssets(assets, "all", "PURR/USDC"))).toEqual(["@1"]);
  });

  test("search ignores case, whitespace and separator style", () => {
    expect(coins(filterTradeAssets(assets, "all", "  purr usdc  "))).toEqual(["@1"]);
    expect(coins(filterTradeAssets(assets, "all", "hype/usdc"))).toEqual(["HYPE"]);
  });
});

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

describe("asset dropdown liveness", () => {
  test("a zero-volume row is not live", () => {
    expect(isLiveMarket(market({ dayNtlVlm: "0.0" }))).toBe(false);
  });

  test("a row with a missing volume is not live", () => {
    const noVolume = market({ coin: "NOVOL" });
    Reflect.deleteProperty(noVolume, "dayNtlVlm");

    expect(isLiveMarket(noVolume)).toBe(false);
  });

  test("NaN, negative and non-numeric volumes are not live", () => {
    expect(isLiveMarket(market({ dayNtlVlm: "not-a-number" }))).toBe(false);
    expect(isLiveMarket(market({ dayNtlVlm: "-500" }))).toBe(false);
    expect(isLiveMarket(market({ dayNtlVlm: "Infinity" }))).toBe(false);
  });

  test("a row with positive volume is live", () => {
    expect(isLiveMarket(market({ dayNtlVlm: "0.5" }))).toBe(true);
  });

  test("the dropdown's live list keeps only volume-bearing rows of the selected set", () => {
    const payload = [
      market({ coin: "BTC" }),
      market({ coin: "OLD", isDelisted: true, dayNtlVlm: "999999" }),
      market({ coin: "DEAD", dayNtlVlm: "0.0" }),
    ];

    expect(coins(selectListedAssets(payload).assets.filter(isLiveMarket))).toEqual(["BTC"]);
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
