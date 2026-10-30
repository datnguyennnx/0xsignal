/// <reference types="bun-types" />
import { afterAll, describe, expect, mock, test } from "bun:test";
import type { AggregatedMarket } from "@0xsignal/shared";

const getMarketsCalls = { count: 0 };

const market = (rawCoin: string, name: string): AggregatedMarket => ({
  coin: rawCoin,
  rawCoin,
  displaySymbol: rawCoin,
  dexPrefix: null,
  isHip3: false,
  quoteCurrency: "USD",
  name,
  category: "spot",
  displayCategory: "spot",
  isDelisted: false,
  dex: "main",
  assetId: 0,
  marketType: "spot",
  markPx: "0",
  prevDayPx: "0",
  openInterest: "0",
  funding: "0",
  dayNtlVlm: "0",
  maxLeverage: 1,
  szDecimals: 2,
});

const mockGetMarkets = (): Promise<AggregatedMarket[]> => {
  getMarketsCalls.count += 1;
  return Promise.resolve([market("AAA", "AAA")]);
};

mock.module("@/services/api/market", () => ({ getMarkets: mockGetMarkets }));

const { resolveHlCoin, setCoinIndexLoader } = await import("./hl-market-stream");

afterAll(() => {
  mock.restore();
});

describe("coin index loader seam", () => {
  test("an injected loader supplies the index and getMarkets is not called", async () => {
    getMarketsCalls.count = 0;
    let loaderCalls = 0;
    setCoinIndexLoader(() => {
      loaderCalls += 1;
      return Promise.resolve([market("BTC", "BTC")]);
    });

    const coin = await resolveHlCoin("BTC");
    expect(coin).toBe("BTC");
    expect(loaderCalls).toBe(1);
    expect(getMarketsCalls.count).toBe(0);
  });

  test("with no loader injected the fallback calls getMarkets", async () => {
    getMarketsCalls.count = 0;
    setCoinIndexLoader(null);

    const coin = await resolveHlCoin("AAA");
    expect(coin).toBe("AAA");
    expect(getMarketsCalls.count).toBe(1);
  });
});
