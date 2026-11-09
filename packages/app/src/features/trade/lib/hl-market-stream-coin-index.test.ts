/// <reference types="bun-types" />
import { afterEach, describe, expect, mock, test } from "bun:test";
import type { AggregatedMarket } from "@0xsignal/shared";

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

const { resolveHlCoin, setCoinIndexLoader } = await import("./hl-market-stream");

const INDEX_WINDOW_MS = 50;

const neverResolves = () => new Promise<never>(() => {});

const raceIndexWindow = <T>(promise: Promise<T>): Promise<T | "timeout"> =>
  Promise.race([
    promise,
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), INDEX_WINDOW_MS);
    }),
  ]);

afterEach(() => {
  setCoinIndexLoader(null);
  mock.restore();
});

describe("perp fast path before the markets index arrives", () => {
  test("a perp resolves while the index loader never settles", async () => {
    setCoinIndexLoader(neverResolves);

    expect(await raceIndexWindow(resolveHlCoin("BTC"))).toBe("BTC");
  });

  test("spot still waits for the index and does not resolve within the window", async () => {
    setCoinIndexLoader(neverResolves);

    expect(await raceIndexWindow(resolveHlCoin("PURR/USDC"))).toBe("timeout");
  });
});

describe("coin index loader seam", () => {
  test("an injected loader supplies the index and the network is not touched", async () => {
    mock.module("@/services/api/market", () => ({
      getMarkets: () => Promise.reject(new Error("network must not be used")),
    }));
    let loaderCalls = 0;
    setCoinIndexLoader(() => {
      loaderCalls += 1;
      return Promise.resolve([market("BTC", "BTC")]);
    });

    const coin = await resolveHlCoin("BTC");
    expect(coin).toBe("BTC");
    expect(loaderCalls).toBe(1);
  });

  test("with no loader injected the fallback resolves the coin through getMarkets", async () => {
    mock.module("@/services/api/market", () => ({
      getMarkets: () => Promise.resolve([market("AAA", "AAA")]),
    }));
    setCoinIndexLoader(null);

    const coin = await resolveHlCoin("AAA");
    expect(coin).toBe("AAA");
  });
});
