import { beforeEach, describe, it, expect, vi } from "vitest";
import { Effect, Layer, Schema } from "effect";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { MarketTimeframeSchema } from "../../../../modules/market-data";
import {
  getCandleSnapshot,
  getAllMids,
  getTicker,
  getOrderBook,
  getTradeAnnotation,
} from "../provider";
import { HyperliquidClient } from "../client";
import { layerUnlimited as rateLimiterUnlimited } from "../../rate-limit";
import type { HyperliquidInfoClient } from "../types";

type Meta = Awaited<ReturnType<InfoClient["meta"]>>;
type AssetCtx = Awaited<ReturnType<InfoClient["metaAndAssetCtxs"]>>[1][number];

const metaResponse = (names: readonly string[]): Meta => ({
  universe: names.map((name) => ({ name, szDecimals: 2, maxLeverage: 50, marginTableId: 0 })),
  marginTables: [],
  collateralToken: 0,
});

const assetCtx = (
  values: Pick<
    AssetCtx,
    "markPx" | "midPx" | "prevDayPx" | "dayNtlVlm" | "openInterest" | "funding"
  >,
): AssetCtx => ({
  ...values,
  premium: null,
  oraclePx: values.markPx,
  impactPxs: null,
  dayBaseVlm: "0",
});

const timeframe = Schema.decodeUnknownSync(MarketTimeframeSchema)("1m");

const metaByDex =
  (namesByDex: Record<string, readonly string[]>) =>
  (params?: { dex?: string }): Promise<[unknown, unknown]> => {
    const names = namesByDex[params?.dex ?? ""] ?? [];
    return Promise.resolve([metaResponse(names), []]);
  };

const createMockInfoClient = () => ({
  candleSnapshot: vi.fn<InfoClient["candleSnapshot"]>(),
  meta: vi.fn<InfoClient["meta"]>(),
  metaAndAssetCtxs: vi.fn<HyperliquidInfoClient["metaAndAssetCtxs"]>(),
  allMids: vi.fn<HyperliquidInfoClient["allMids"]>(),
  perpCategories: vi.fn<NonNullable<HyperliquidInfoClient["perpCategories"]>>(),
  perpDexs: vi.fn<NonNullable<HyperliquidInfoClient["perpDexs"]>>().mockResolvedValue([]),
  spotMeta: vi
    .fn<NonNullable<HyperliquidInfoClient["spotMeta"]>>()
    .mockResolvedValue({ universe: [], tokens: [] }),
  l2Book: vi.fn<InfoClient["l2Book"]>(),
  perpAnnotation: vi.fn<InfoClient["perpAnnotation"]>(),
});

// Fresh mock for each test using vi.restoreAllMocks in beforeEach
let mockInfoClient: ReturnType<typeof createMockInfoClient>;

const makeClientLayer = () =>
  Layer.mergeAll(
    Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({
        info: Object.assign(new InfoClient({ transport: new HttpTransport() }), mockInfoClient),
      }),
    ),
    rateLimiterUnlimited,
  );

describe("Hyperliquid Providers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockInfoClient = createMockInfoClient();
  });

  it("getCandleSnapshot should call SDK and normalize results", async () => {
    mockInfoClient.candleSnapshot.mockResolvedValue([
      { t: 1000, T: 2000, s: "BTC", i: "1m", o: "1", h: "2", l: "0.5", c: "1.5", v: "10", n: 5 },
    ]);
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse([]), []]);

    const clientLayer = makeClientLayer();

    const program = getCandleSnapshot("BTC", timeframe, 0, 2000);
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

    const clientLayer = makeClientLayer();

    const program = getAllMids().pipe(Effect.provide(clientLayer));

    await expect(Effect.runPromise(program)).rejects.toThrow("Failed to fetch all mids");
  });

  it("getTicker should map allMids into stable payload", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([
      metaResponse(["BTC"]),
      [
        assetCtx({
          markPx: "101",
          midPx: "101.25",
          prevDayPx: "99",
          dayNtlVlm: "10000",
          openInterest: "2500",
          funding: "0.0002",
        }),
      ],
    ]);
    mockInfoClient.allMids.mockResolvedValue({ BTC: "101.25" });

    const clientLayer = makeClientLayer();

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
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([
      metaResponse(["BTC"]),
      [
        assetCtx({
          markPx: "101",
          midPx: "101.25",
          prevDayPx: "99",
          dayNtlVlm: "10000",
          openInterest: "2500",
          funding: "0.0002",
        }),
      ],
    ]);
    mockInfoClient.allMids.mockResolvedValue({ BTC: "101.25" });

    const clientLayer = makeClientLayer();

    await expect(
      Effect.runPromise(getTicker("XRP").pipe(Effect.provide(clientLayer))),
    ).rejects.toThrow("Symbol not found: XRP");
  });

  it("getTicker resolves a coin that only exists on a builder dex", async () => {
    mockInfoClient.perpDexs.mockResolvedValue([{ name: "xyz" }]);
    mockInfoClient.metaAndAssetCtxs.mockImplementation(
      metaByDex({ "": ["BTC"], xyz: ["xyz:ONLY"] }),
    );
    mockInfoClient.allMids.mockResolvedValue({ "xyz:ONLY": "5" });

    const result = await Effect.runPromise(
      getTicker("ONLY").pipe(Effect.provide(makeClientLayer())),
    );

    expect(result.symbol).toBe("xyz:ONLY");
    expect(result.mid).toBe(5);
  });

  it("getTicker reports an ambiguity when two builder dexes share a coin", async () => {
    mockInfoClient.perpDexs.mockResolvedValue([{ name: "xyz" }, { name: "abc" }]);
    mockInfoClient.metaAndAssetCtxs.mockImplementation(
      metaByDex({ "": ["BTC"], xyz: ["xyz:ONLY"], abc: ["abc:ONLY"] }),
    );
    mockInfoClient.allMids.mockResolvedValue({});

    await expect(
      Effect.runPromise(getTicker("ONLY").pipe(Effect.provide(makeClientLayer()))),
    ).rejects.toThrow("ambig");
  });

  it("getOrderBook should call l2Book with normalized symbol", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse(["ETH"]), []]);
    mockInfoClient.l2Book.mockResolvedValue({
      coin: "ETH",
      time: 123,
      levels: [[], []],
    });

    const clientLayer = makeClientLayer();

    const result = await Effect.runPromise(
      getOrderBook("eth", 3).pipe(Effect.provide(clientLayer)),
    );

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "ETH", nSigFigs: 3 });
    expect(result.symbol).toBe("ETH");
    expect(result.nSigFigs).toBe(3);
  });

  it("getOrderBook should keep builder-perp dex lowercase while normalizing coin", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse(["dex:CL"]), []]);
    mockInfoClient.l2Book.mockResolvedValue({
      coin: "dex:CL",
      time: 123,
      levels: [[], []],
    });

    const clientLayer = makeClientLayer();

    const result = await Effect.runPromise(
      getOrderBook("DEX:clusdt", 4).pipe(Effect.provide(clientLayer)),
    );

    // normalizeSymbol("DEX:clusdt") resolves to "dex:CL" (strips USDT suffix, lowercases dex)
    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "dex:CL", nSigFigs: 4 });
    expect(result.symbol).toBe("dex:CL");
  });

  it("getOrderBook defaults to null nSigFigs (full precision) when depth not specified", async () => {
    mockInfoClient.allMids.mockResolvedValue({});
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse(["BTC"]), []]);
    mockInfoClient.l2Book.mockResolvedValue({
      coin: "BTC",
      time: 123,
      levels: [[], []],
    });

    const clientLayer = makeClientLayer();

    const result = await Effect.runPromise(getOrderBook("btc").pipe(Effect.provide(clientLayer)));

    expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "BTC", nSigFigs: null });
    expect(result.nSigFigs).toBeNull();
  });

  it("getTradeAnnotation should call perpAnnotation", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse(["SOL"]), []]);
    mockInfoClient.allMids.mockResolvedValue({ SOL: "100" });
    mockInfoClient.perpAnnotation.mockResolvedValue({
      category: "major",
      description: "Major market",
    });

    const clientLayer = makeClientLayer();

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
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse(["dex:CL"]), []]);
    mockInfoClient.perpAnnotation.mockResolvedValue({
      category: "major",
      description: "Major market",
    });

    const clientLayer = makeClientLayer();

    const result = await Effect.runPromise(
      getTradeAnnotation("DEX:clusdt").pipe(Effect.provide(clientLayer)),
    );

    // The ticker snapshot resolves DEX:clusdt to dex:CL (from universe),
    // so perpAnnotation is called with dex:CL
    expect(mockInfoClient.perpAnnotation).toHaveBeenCalledWith({ coin: "dex:CL" });
    // But the return symbol is normalized from the input
    expect(result.symbol).toBe("dex:CL");
    expect(result.annotation).toEqual({ category: "major", description: "Major market" });
  });
});
