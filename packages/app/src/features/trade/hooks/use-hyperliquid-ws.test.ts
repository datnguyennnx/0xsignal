/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";

const { bookWriteMeta, routeMarketMessageToStore } = await import("./use-hyperliquid-ws");
const { decodeMarketWsMessage } = await import("../utils/market-stream-decoder");
const { useMarketDataStore } = await import("@/stores/use-market-data-store");

const LEVELS = [[{ px: "100", sz: "1", n: 1 }], [{ px: "101", sz: "1", n: 1 }]];

const CAPTURED_TRADES = [
  {
    coin: "BTC",
    side: "B",
    px: "74049.0",
    sz: "0.22207",
    hash: "0xabc",
    time: 1794388497188,
    tid: 123,
    users: ["0x1", "0x2"],
  },
];

describe("bookWriteMeta", () => {
  test("a merged frame forwards its time and degraded legs", () => {
    expect(
      bookWriteMeta({
        type: "snapshot",
        levels: LEVELS,
        time: 1794388497188,
        degraded: ["slow"],
      }),
    ).toEqual({ time: 1794388497188, degraded: ["slow"] });
  });

  test("a REST seed snapshot has no arrival metadata to forward", () => {
    expect(bookWriteMeta({ type: "snapshot", levels: LEVELS })).toEqual({});
  });

  test("a malformed degraded list is not forwarded", () => {
    expect(
      bookWriteMeta({ type: "snapshot", levels: LEVELS, degraded: ["fast", "stale"] }),
    ).toEqual({});
  });

  test("a non-finite time is not forwarded", () => {
    expect(bookWriteMeta({ type: "snapshot", levels: LEVELS, time: Number.NaN })).toEqual({});
  });
});

describe("trades routing", () => {
  beforeEach(() => {
    useMarketDataStore.setState({ trades: {} });
  });

  test("a captured trade frame decodes and reaches the store", () => {
    const decoded = decodeMarketWsMessage(
      JSON.stringify({ channel: "trades", data: CAPTURED_TRADES }),
      "trades",
    );

    expect(decoded.kind).toBe("market");
    if (decoded.kind !== "market") return;

    routeMarketMessageToStore(decoded.payload, decoded.channel, decoded.meta);

    expect(useMarketDataStore.getState().trades["BTC"]?.[0]).toEqual({
      px: 74049,
      sz: 0.22207,
      time: 1794388497188,
      side: "buy",
      hash: "0xabc",
      tid: 123,
    });
  });

  test("a direct batch routes under the coin carried by the frame", () => {
    routeMarketMessageToStore(CAPTURED_TRADES, "trades");

    expect(useMarketDataStore.getState().trades["BTC"]?.[0]?.tid).toBe(123);
  });

  test("a spot frame writes under the caller's display symbol", () => {
    const spotTrades = [{ ...CAPTURED_TRADES[0], coin: "@107" }];

    routeMarketMessageToStore(spotTrades, "trades", { coin: "@107" }, "PURR/USDC");

    expect(useMarketDataStore.getState().trades["PURR/USDC"]?.[0]?.tid).toBe(123);
    expect(useMarketDataStore.getState().trades["@107"]).toBeUndefined();
  });

  test("a perp frame writes under the perp symbol", () => {
    routeMarketMessageToStore(CAPTURED_TRADES, "trades", { coin: "BTC" }, "BTC");

    expect(useMarketDataStore.getState().trades["BTC"]?.[0]?.tid).toBe(123);
  });

  test("an empty batch resolves the symbol but writes nothing", () => {
    routeMarketMessageToStore([], "trades", { coin: "@107" }, "PURR/USDC");

    expect(useMarketDataStore.getState().trades).toEqual({});
  });
});
