import { beforeEach, describe, it, expect, vi } from "vitest";
import { Effect, Layer } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import {
  getCandleSnapshot,
  getMetadata,
  getAllMids,
  getTicker,
  getOrderBook,
  getTradeAnnotation,
  HyperliquidProviderLive,
} from "../provider";
import { HyperliquidProvider } from "../types";
import { HyperliquidClient } from "../client";

const mockInfoClient = {
  candleSnapshot: vi.fn(),
  meta: vi.fn(),
  metaAndAssetCtxs: vi.fn(),
  allMids: vi.fn(),
  perpCategories: vi.fn(),
  l2Book: vi.fn(),
  perpAnnotation: vi.fn(),
};

const TestHLClientLive = Layer.succeed(
  HyperliquidClient,
  HyperliquidClient.of({
    info: mockInfoClient as unknown as InfoClient,
  })
);

describe("Hyperliquid Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCandleSnapshot should call SDK and normalize results", async () => {
    mockInfoClient.candleSnapshot.mockResolvedValueOnce([
      { t: 1000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10" },
    ]);

    const program = getCandleSnapshot("BTC", "1m", 0, 2000);
    const result = await Effect.runPromise(program.pipe(Effect.provide(TestHLClientLive)));

    expect(mockInfoClient.candleSnapshot).toHaveBeenCalledWith({
      coin: "BTC",
      interval: "1m",
      startTime: 0,
      endTime: 2000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(1);
  });

  it("getMetadata should call SDK and return data", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValueOnce([
      { universe: [{ name: "BTC", maxLeverage: 40 }] },
      [
        {
          prevDayPx: "100",
          dayNtlVlm: "12345",
          markPx: "101",
          midPx: "101.5",
          funding: "0.0001",
          openInterest: "999",
        },
      ],
    ]);
    mockInfoClient.allMids.mockResolvedValueOnce({ BTC: "101.5" });
    mockInfoClient.perpCategories.mockResolvedValueOnce([["BTC", "crypto"]]);

    const program = getMetadata();
    const result = await Effect.runPromise(program.pipe(Effect.provide(TestHLClientLive)));

    expect(mockInfoClient.metaAndAssetCtxs).toHaveBeenCalled();
    expect(mockInfoClient.allMids).toHaveBeenCalled();
    expect(mockInfoClient.perpCategories).toHaveBeenCalled();
    expect(mockInfoClient.perpAnnotation).not.toHaveBeenCalled();
    expect(result.universe).toHaveLength(1);
    expect(result.assetCtxs).toHaveLength(1);
    expect(result.allMids).toEqual({ BTC: "101.5" });
    expect(result.perpCategories).toEqual([["BTC", "crypto"]]);
  });

  it("getMetadata should gracefully fallback category when perpCategories fails", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValueOnce([
      { universe: [{ name: "ETH", maxLeverage: 30 }] },
      [
        {
          markPx: "3200",
          midPx: "3201",
        },
      ],
    ]);
    mockInfoClient.allMids.mockResolvedValueOnce({ ETH: "3201" });
    mockInfoClient.perpCategories.mockRejectedValueOnce(new Error("timeout"));

    const result = await Effect.runPromise(getMetadata().pipe(Effect.provide(TestHLClientLive)));

    expect(result.perpCategories).toEqual([["ETH", "crypto"]]);
  });

  it("should wrap HL SDK errors into HyperliquidError", async () => {
    mockInfoClient.allMids.mockRejectedValueOnce(new Error("Rate Limit"));

    const program = getAllMids().pipe(Effect.provide(TestHLClientLive));

    await expect(Effect.runPromise(program)).rejects.toThrow("Failed to fetch all mids");
  });

  it("getTicker should map allMids into stable payload", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValueOnce([
      { universe: [{ name: "BTC" }] },
      [
        {
          markPx: "101",
          midPx: "101.25",
          prevDayPx: "99",
          dayNtlVlm: "10000",
          openInterest: "2500",
          funding: "0.0002",
        },
      ],
    ]);
    mockInfoClient.allMids.mockResolvedValueOnce({ BTC: "101.25" });

    const result = await Effect.runPromise(getTicker("btc").pipe(Effect.provide(TestHLClientLive)));

    expect(result).toEqual({
      symbol: "BTC",
      mid: 101.25,
      markPx: 101,
      midPx: 101.25,
      prevDayPx: 99,
      dayNtlVlm: 10000,
      openInterest: 2500,
      funding: 0.0002,
    });
  });

  it("getTicker should return not found when symbol does not exist", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValueOnce([{ universe: [{ name: "BTC" }] }, [{}]]);
    mockInfoClient.allMids.mockResolvedValueOnce({ BTC: "101.25" });

    await expect(
      Effect.runPromise(getTicker("XRP").pipe(Effect.provide(TestHLClientLive)))
    ).rejects.toThrow("Symbol not found: XRP");
  });

  it("getOrderBook should call l2Book with normalized symbol", async () => {
    mockInfoClient.l2Book.mockResolvedValueOnce({
      coin: "ETH",
      time: 123,
      levels: [[], []],
    });

    const result = await Effect.runPromise(
      getOrderBook("eth", 3).pipe(Effect.provide(TestHLClientLive))
    );

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "ETH", nSigFigs: 3 });
    expect(result.symbol).toBe("ETH");
    expect(result.nSigFigs).toBe(3);
  });

  it("getOrderBook should keep builder-perp dex lowercase while normalizing coin", async () => {
    mockInfoClient.l2Book.mockResolvedValueOnce({
      coin: "dex:CL",
      time: 123,
      levels: [[], []],
    });

    await Effect.runPromise(getOrderBook("DEX:clusdt", 4).pipe(Effect.provide(TestHLClientLive)));

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "dex:CL", nSigFigs: 4 });
  });

  it("getTradeAnnotation should call perpAnnotation", async () => {
    mockInfoClient.perpAnnotation.mockResolvedValueOnce({
      category: "major",
      description: "Major market",
    });

    const result = await Effect.runPromise(
      getTradeAnnotation("sol").pipe(Effect.provide(TestHLClientLive))
    );

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "SOL" });
    expect(result.symbol).toBe("SOL");
    expect(result.annotation).toEqual({
      category: "major",
      description: "Major market",
    });
  });

  it("getTradeAnnotation should preserve builder-perp canonical symbol", async () => {
    mockInfoClient.perpAnnotation.mockResolvedValueOnce({ category: "major" });

    const result = await Effect.runPromise(
      getTradeAnnotation("DEX:clusdt").pipe(Effect.provide(TestHLClientLive))
    );

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "dex:CL" });
    expect(result.symbol).toBe("dex:CL");
  });

  it("HyperliquidProviderLive caches ticker snapshot for short ttl", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([
      { universe: [{ name: "BTC" }] },
      [{ markPx: "101", midPx: "101.25" }],
    ]);
    mockInfoClient.allMids.mockResolvedValue({ BTC: "101.25" });

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(new Date("2026-01-01T00:00:00.000Z").getTime());

    const provider = HyperliquidProviderLive(
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient })
    );
    const layer = Layer.succeed(HyperliquidProvider, provider);

    const first = Effect.flatMap(HyperliquidProvider, (svc) => svc.getTicker("BTC")).pipe(
      Effect.provide(layer)
    );
    const second = Effect.flatMap(HyperliquidProvider, (svc) => svc.getTicker("BTC")).pipe(
      Effect.provide(layer)
    );

    await Effect.runPromise(first);
    await Effect.runPromise(second);

    expect(mockInfoClient.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
    expect(mockInfoClient.allMids).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(new Date("2026-01-01T00:00:01.500Z").getTime());

    const third = Effect.flatMap(HyperliquidProvider, (svc) => svc.getTicker("BTC")).pipe(
      Effect.provide(layer)
    );
    await Effect.runPromise(third);

    expect(mockInfoClient.metaAndAssetCtxs).toHaveBeenCalledTimes(2);
    expect(mockInfoClient.allMids).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it("HyperliquidProviderLive caches trade annotation", async () => {
    mockInfoClient.perpAnnotation.mockResolvedValue({ category: "major" });

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(new Date("2026-01-01T00:00:00.000Z").getTime());

    const provider = HyperliquidProviderLive(
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient })
    );
    const layer = Layer.succeed(HyperliquidProvider, provider);

    const first = Effect.flatMap(HyperliquidProvider, (svc) => svc.getTradeAnnotation("BTC")).pipe(
      Effect.provide(layer)
    );
    const second = Effect.flatMap(HyperliquidProvider, (svc) => svc.getTradeAnnotation("BTC")).pipe(
      Effect.provide(layer)
    );

    await Effect.runPromise(first);
    await Effect.runPromise(second);

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(new Date("2026-01-01T07:00:00.000Z").getTime());

    const third = Effect.flatMap(HyperliquidProvider, (svc) => svc.getTradeAnnotation("BTC")).pipe(
      Effect.provide(layer)
    );
    await Effect.runPromise(third);

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it("HyperliquidProviderLive caches candle snapshots for short ttl", async () => {
    mockInfoClient.candleSnapshot.mockResolvedValue([
      { t: 1000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10" },
    ]);

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(new Date("2026-01-01T00:00:00.000Z").getTime());

    const provider = HyperliquidProviderLive(
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient })
    );
    const layer = Layer.succeed(HyperliquidProvider, provider);

    const first = Effect.flatMap(HyperliquidProvider, (svc) =>
      svc.getCandleSnapshot("BTC", "1m", 0, 60000)
    ).pipe(Effect.provide(layer));
    const second = Effect.flatMap(HyperliquidProvider, (svc) =>
      svc.getCandleSnapshot("BTC", "1m", 0, 60000)
    ).pipe(Effect.provide(layer));

    await Effect.runPromise(first);
    await Effect.runPromise(second);

    expect(mockInfoClient.candleSnapshot).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(new Date("2026-01-01T00:00:01.500Z").getTime());

    const third = Effect.flatMap(HyperliquidProvider, (svc) =>
      svc.getCandleSnapshot("BTC", "1m", 0, 60000)
    ).pipe(Effect.provide(layer));
    await Effect.runPromise(third);

    expect(mockInfoClient.candleSnapshot).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });
});
