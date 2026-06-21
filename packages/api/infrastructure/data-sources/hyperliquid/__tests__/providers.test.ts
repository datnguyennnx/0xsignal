import { beforeEach, describe, it, expect, vi } from "vitest";
import { Effect, Layer } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import {
  getCandleSnapshot,
  getAllMids,
  getTicker,
  getOrderBook,
  getTradeAnnotation,
} from "../provider";
import { HyperliquidClient } from "../client";

const createMockInfoClient = () => ({
  candleSnapshot: vi.fn(),
  meta: vi.fn(),
  metaAndAssetCtxs: vi.fn(),
  allMids: vi.fn(),
  perpCategories: vi.fn(),
  l2Book: vi.fn(),
  perpAnnotation: vi.fn(),
});

// Fresh mock for each test using vi.restoreAllMocks in beforeEach
let mockInfoClient: ReturnType<typeof createMockInfoClient>;

describe("Hyperliquid Providers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockInfoClient = createMockInfoClient();
  });

  it("getCandleSnapshot should call SDK and normalize results", async () => {
    mockInfoClient.candleSnapshot.mockResolvedValue([
      { t: 1000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10" },
    ]);
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [] }, []]);

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const program = getCandleSnapshot("BTC", "1m", 0, 2000);
    const result = await Effect.runPromise(program.pipe(Effect.provide(clientLayer)));

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
    mockInfoClient.allMids.mockRejectedValue(new Error("Rate Limit"));

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const program = getAllMids().pipe(Effect.provide(clientLayer));

    await expect(Effect.runPromise(program)).rejects.toThrow("Failed to fetch all mids");
  });

  it("getTicker should map allMids into stable payload", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([
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
    mockInfoClient.allMids.mockResolvedValue({ BTC: "101.25" });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const result = await Effect.runPromise(getTicker("btc").pipe(Effect.provide(clientLayer)));

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
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [{ name: "BTC" }] }, [{}]]);
    mockInfoClient.allMids.mockResolvedValue({ BTC: "101.25" });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    await expect(
      Effect.runPromise(getTicker("XRP").pipe(Effect.provide(clientLayer))),
    ).rejects.toThrow("Symbol not found: XRP");
  });

  it("getOrderBook should call l2Book with normalized symbol", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [] }, []]);
    mockInfoClient.l2Book.mockResolvedValue({
      coin: "ETH",
      time: 123,
      levels: [[], []],
    });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const result = await Effect.runPromise(
      getOrderBook("eth", 3).pipe(Effect.provide(clientLayer)),
    );

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "ETH", nSigFigs: 3 });
    expect(result.symbol).toBe("ETH");
    expect(result.nSigFigs).toBe(3);
  });

  it("getOrderBook should keep builder-perp dex lowercase while normalizing coin", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [] }, []]);
    mockInfoClient.l2Book.mockResolvedValue({
      coin: "dex:CL",
      time: 123,
      levels: [[], []],
    });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const result = await Effect.runPromise(
      getOrderBook("DEX:clusdt", 4).pipe(Effect.provide(clientLayer)),
    );

    // normalizeSymbol("DEX:clusdt") resolves to "dex:CL" (strips USDT suffix, lowercases dex)
    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "dex:CL", nSigFigs: 4 });
    expect(result.symbol).toBe("dex:CL");
  });

  it("getOrderBook defaults to null nSigFigs (full precision) when depth not specified", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [] }, []]);
    mockInfoClient.l2Book.mockResolvedValue({
      coin: "BTC",
      time: 123,
      levels: [[], []],
    });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const result = await Effect.runPromise(getOrderBook("btc").pipe(Effect.provide(clientLayer)));

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "BTC", nSigFigs: null });
    expect(result.nSigFigs).toBeNull();
  });

  it("getTradeAnnotation should call perpAnnotation", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [{ name: "SOL" }] }, []]);
    mockInfoClient.allMids.mockResolvedValue({ SOL: "100" });
    mockInfoClient.perpAnnotation.mockResolvedValue({
      category: "major",
      description: "Major market",
    });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const result = await Effect.runPromise(
      getTradeAnnotation("sol").pipe(Effect.provide(clientLayer)),
    );

    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "SOL" });
    expect(result.symbol).toBe("SOL");
    expect(result.annotation).toEqual({
      category: "major",
      description: "Major market",
    });
  });

  it("getTradeAnnotation should preserve builder-perp canonical symbol", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([{ universe: [{ name: "dex:CL" }] }, []]);
    mockInfoClient.perpAnnotation.mockResolvedValue({ category: "major" });

    const clientLayer = Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({ info: mockInfoClient as unknown as InfoClient }),
    );

    const result = await Effect.runPromise(
      getTradeAnnotation("DEX:clusdt").pipe(Effect.provide(clientLayer)),
    );

    // The ticker snapshot resolves DEX:clusdt to dex:CL (from universe),
    // so perpAnnotation is called with dex:CL
    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "dex:CL" });
    // But the return symbol is normalized from the input
    expect(result.symbol).toBe("dex:CL");
    expect(result.annotation).toEqual({ category: "major" });
  });
});
