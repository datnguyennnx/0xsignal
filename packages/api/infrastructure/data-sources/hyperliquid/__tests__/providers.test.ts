import { beforeEach, describe, it, expect, vi } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { Cache, Duration } from "effect";
import { makeUnsafe as makeSemaphoreUnsafe } from "effect/Semaphore";
import type { InfoClient } from "@nktkas/hyperliquid";
import {
  getCandleSnapshot,
  getAllMids,
  getTicker,
  getOrderBook,
  getTradeAnnotation,
} from "../provider";
import { HyperliquidClient } from "../client";
import { HyperliquidError } from "../errors";
import { HyperliquidRateLimiter } from "../rate-limiter";
import { HyperliquidDeduplicationRegistry } from "../dedup";

const mockInfoClient = {
  candleSnapshot: vi.fn(),
  meta: vi.fn(),
  metaAndAssetCtxs: vi.fn(),
  allMids: vi.fn(),
  perpCategories: vi.fn(),
  l2Book: vi.fn(),
  perpAnnotation: vi.fn(),
};

const TestHLClientLayer = Layer.succeed(
  HyperliquidClient,
  HyperliquidClient.of({
    info: mockInfoClient as unknown as InfoClient,
  }),
);

const TestRateLimiterLayer = Layer.succeed(
  HyperliquidRateLimiter,
  HyperliquidRateLimiter.of({
    semaphore: makeSemaphoreUnsafe(6),
    withRateLimit: () => Effect.void,
  }),
);

const TestDedupLayer = Layer.effect(
  HyperliquidDeduplicationRegistry,
  Effect.gen(function* () {
    const lookupRef = yield* Ref.make<Map<string, Effect.Effect<any, HyperliquidError>>>(new Map());
    const cache = yield* Cache.make<string, any, HyperliquidError, never>({
      capacity: 100,
      timeToLive: Duration.seconds(30),
      lookup: (key: string): Effect.Effect<any, HyperliquidError, never> =>
        Ref.get(lookupRef).pipe(
          Effect.flatMap((map) => {
            const effect = map.get(key);
            if (effect) return effect;
            return Effect.die(new Error(`[Test] No dedup lookup registered for key: ${key}`));
          }),
        ),
    });
    return HyperliquidDeduplicationRegistry.of({ cache, lookupRef });
  }),
);

const TestLayer = Layer.mergeAll(TestHLClientLayer, TestRateLimiterLayer, TestDedupLayer);

describe("Hyperliquid Providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCandleSnapshot should call SDK and normalize results", async () => {
    mockInfoClient.candleSnapshot.mockResolvedValueOnce([
      { t: 1000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10" },
    ]);

    const program = getCandleSnapshot("BTC", "1m", 0, 2000);
    const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(mockInfoClient.candleSnapshot).toHaveBeenCalledWith({
      coin: "BTC",
      interval: "1m",
      startTime: 0,
      endTime: 2000,
    });
    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(1);
  });

  it("should wrap HL SDK errors into HyperliquidError", async () => {
    mockInfoClient.allMids.mockRejectedValueOnce(new Error("Rate Limit"));

    const program = getAllMids().pipe(Effect.provide(TestLayer));

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

    const result = await Effect.runPromise(getTicker("btc").pipe(Effect.provide(TestLayer)));

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
      Effect.runPromise(getTicker("XRP").pipe(Effect.provide(TestLayer))),
    ).rejects.toThrow("Symbol not found: XRP");
  });

  it("getOrderBook should call l2Book with normalized symbol", async () => {
    mockInfoClient.l2Book.mockResolvedValueOnce({
      coin: "ETH",
      time: 123,
      levels: [[], []],
    });

    const result = await Effect.runPromise(getOrderBook("eth", 3).pipe(Effect.provide(TestLayer)));

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

    await Effect.runPromise(getOrderBook("DEX:clusdt", 4).pipe(Effect.provide(TestLayer)));

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "dex:CL", nSigFigs: 4 });
  });

  it("getTradeAnnotation should call perpAnnotation", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValueOnce([{ universe: [{ name: "SOL" }] }, []]);
    mockInfoClient.perpAnnotation.mockResolvedValueOnce({
      category: "major",
      description: "Major market",
    });

    const result = await Effect.runPromise(
      getTradeAnnotation("sol").pipe(Effect.provide(TestLayer)),
    );

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "SOL" });
    expect(result.symbol).toBe("SOL");
    expect(result.annotation).toEqual({
      category: "major",
      description: "Major market",
    });
  });

  it("getTradeAnnotation should preserve builder-perp canonical symbol", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValueOnce([{ universe: [{ name: "dex:CL" }] }, []]);
    mockInfoClient.perpAnnotation.mockResolvedValueOnce({ category: "major" });

    const result = await Effect.runPromise(
      getTradeAnnotation("DEX:clusdt").pipe(Effect.provide(TestLayer)),
    );

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "dex:CL" });
    expect(result.symbol).toBe("dex:CL");
  });
});
