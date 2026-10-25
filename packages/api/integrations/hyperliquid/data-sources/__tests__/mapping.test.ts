import { describe, it, expect, vi } from "vitest";
import { Effect, Option, Result } from "effect";
import { getTickerSnapshot } from "../mapping";
import { layerUnlimited as rateLimiterUnlimited } from "../../rate-limit";
import {
  mapTickerFromSnapshot,
  resolveInternalSymbol,
  parseSpotAssets,
  extractSpotTokens,
  sortAndDedupeAssets,
} from "../market-aggregation";
import type {
  HyperliquidInfoClient,
  PerpTradeAsset,
  SpotTradeAsset,
  TickerSnapshot,
} from "../types";

const failureOf = <A, E>(result: Result.Result<A, E>): E =>
  Option.getOrThrow(
    Result.match(result, {
      onSuccess: () => Option.none<E>(),
      onFailure: (error) => Option.some(error),
    }),
  );

const baseAsset = (coin: string, rawCoin: string, dexPrefix: string | null, dayNtlVlm: string) => ({
  coin,
  rawCoin,
  displaySymbol: coin,
  dexPrefix,
  isHip3: dexPrefix !== null,
  quoteCurrency: "USDC",
  name: coin,
  dex: "HYPERLIQUID" as const,
  assetId: 0,
  dayNtlVlm,
});

describe("Hyperliquid Mapping", () => {
  const mockInfo = {
    metaAndAssetCtxs: vi
      .fn<HyperliquidInfoClient["metaAndAssetCtxs"]>()
      .mockResolvedValue([null, null]),
    allMids: vi.fn<HyperliquidInfoClient["allMids"]>().mockResolvedValue({}),
    perpCategories: vi
      .fn<NonNullable<HyperliquidInfoClient["perpCategories"]>>()
      .mockResolvedValue([]),
    perpDexs: vi.fn<NonNullable<HyperliquidInfoClient["perpDexs"]>>().mockResolvedValue([]),
  };

  describe("mapTickerFromSnapshot", () => {
    const mockSnapshot = {
      universe: [{ name: "BTC", maxLeverage: 50 }],
      assetCtxs: [{ midPx: "50000", markPx: "50005" }],
      allMids: { BTC: "50000" },
    } satisfies TickerSnapshot;

    it("should map standard perp ticker correctly", () => {
      const result = Result.getOrThrow(mapTickerFromSnapshot(mockSnapshot, "BTC"));
      expect(result.symbol).toBe("BTC");
      expect(result.mid).toBe(50000);
      expect(result.markPx).toBe(50005);
    });

    it("should fail with NOT_FOUND for unknown symbol", () => {
      const error = failureOf(mapTickerFromSnapshot(mockSnapshot, "UNKNOWN"));
      expect(error).toMatchObject({ _tag: "TickerSnapshotError", kind: "NOT_FOUND" });
      expect(error.message).toMatch(/Symbol not found/);
    });
  });

  describe("resolveInternalSymbol", () => {
    const mockSnapshot: TickerSnapshot = {
      universe: [{ name: "para:BTCD" }],
      assetCtxs: [],
      allMids: {},
    };

    it("should resolve builder perp", () => {
      expect(resolveInternalSymbol(mockSnapshot, "PARA:BTCD")).toBe("para:BTCD");
    });

    it("should return same symbol for unknown", () => {
      expect(resolveInternalSymbol(mockSnapshot, "ETH")).toBe("ETH");
    });
  });

  describe("Aggregation", () => {
    it("should aggregate main and builder DEX perps", async () => {
      mockInfo.perpDexs.mockResolvedValue([{ name: "xyz" }]);
      mockInfo.metaAndAssetCtxs
        .mockResolvedValueOnce([{ universe: [{ name: "BTC" }] }, [{ midPx: "50000" }]]) // Main
        .mockResolvedValueOnce([{ universe: [{ name: "xyz:EUR" }] }, [{ midPx: "1.1" }]]); // xyz

      const result = await Effect.runPromise(
        Effect.provide(getTickerSnapshot(mockInfo), rateLimiterUnlimited),
      );

      expect(result.universe).toHaveLength(2);
      expect(result.universe[0].name).toBe("BTC");
      expect(result.universe[1].name).toBe("xyz:EUR");
      expect(result.universe[1].dexIndex).toBe(1);
    });

    it("should handle partial DEX failures", async () => {
      mockInfo.perpDexs.mockResolvedValue([{ name: "offline" }]);
      mockInfo.metaAndAssetCtxs
        .mockResolvedValueOnce([{ universe: [{ name: "BTC" }] }, [{ midPx: "50000" }]]) // Main
        .mockRejectedValueOnce(new Error("DEX Offline"));

      const result = await Effect.runPromise(
        Effect.provide(getTickerSnapshot(mockInfo), rateLimiterUnlimited),
      );

      expect(result.universe).toHaveLength(1); // Only main DEX succeeded
      expect(result.universe[0].name).toBe("BTC");
    });
  });

  describe("resolveInternalSymbol with normalization", () => {
    const mockSnapshot: TickerSnapshot = {
      universe: [{ name: "para:BTCD" }],
      assetCtxs: [],
      allMids: {},
    };

    it("should resolve with different casing and suffix", () => {
      expect(resolveInternalSymbol(mockSnapshot, "PARA:BTCD-USDT")).toBe("para:BTCD");
    });
  });

  describe("parseSpotAssets", () => {
    const spotTokens = [
      { name: "USDC", index: 0, szDecimals: 2 },
      { name: "PURR", index: 1, szDecimals: 2 },
      { name: "HFUN", index: 2, szDecimals: 2 },
      { name: "LICK", index: 3, szDecimals: 0 },
    ];

    const spotUniverse = [
      { tokens: [1, 0], name: "PURR/USDC", index: 0, isCanonical: true },
      { tokens: [2, 0], name: "@1", index: 1, isCanonical: false },
      { tokens: [3, 0], name: "@2", index: 2, isCanonical: false },
    ];

    const assetCtxs = [
      {
        prevDayPx: "0.08",
        dayNtlVlm: "1000",
        markPx: "0.09",
        midPx: "0.089",
        circulatingSupply: "500000",
        coin: "PURR/USDC",
        totalSupply: "500000",
        dayBaseVlm: "10000",
      },
      {
        prevDayPx: "10.0",
        dayNtlVlm: "500",
        markPx: "10.05",
        midPx: "10.03",
        circulatingSupply: "1000000",
        coin: "@1",
        totalSupply: "1000000",
        dayBaseVlm: "5000",
      },
      {
        prevDayPx: "0.00005",
        dayNtlVlm: "0",
        markPx: "0.00005",
        midPx: "0.00005",
        circulatingSupply: "1e9",
        coin: "@2",
        totalSupply: "1e9",
        dayBaseVlm: "0",
      },
    ];

    const allMids: Record<string, string> = {
      "PURR/USDC": "0.0895",
      "@1": "10.05",
      "@2": "0.00005",
    };

    it("skips zero-volume pairs, includes active canonical + non-canonical", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids, 0);
      // PURR (vol=1000) and HFUN (vol=500) included; LICK (vol=0) filtered
      expect(result).toHaveLength(2);
      expect(result[0].coin).toBe("PURR");
      expect(result[1].coin).toBe("HFUN");
    });

    it("resolves token names and quote currency correctly", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids, 0);

      const hfun = result.find((a) => a.coin === "HFUN")!;
      expect(hfun.rawCoin).toBe("HFUN/USDC");
      expect(hfun.displaySymbol).toBe("HFUN-USDC");
      expect(hfun.quoteCurrency).toBe("USDC");
      expect(hfun.marketType).toBe("spot");
    });

    it("reads prices from allMids using entry.name", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids, 0);

      const purr = result.find((a) => a.coin === "PURR")!;
      expect(purr.markPx).toBe("0.0895"); // from allMids["PURR/USDC"]

      const hfun = result.find((a) => a.coin === "HFUN")!;
      expect(hfun.markPx).toBe("10.05"); // from allMids["@1"]
    });

    it("falls back to ctx fields when allMids missing", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, {}, 0);

      const purr = result.find((a) => a.coin === "PURR")!;
      expect(purr.markPx).toBe("0.09"); // from ctx.markPx
    });

    it("filters zero-volume dead pairs", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids, 0);
      // LICK has dayNtlVlm=0 → filtered out
      expect(result.find((a) => a.coin === "LICK")).toBeUndefined();
      // PURR has dayNtlVlm=1000 → included
      expect(result.find((a) => a.coin === "PURR")).toBeDefined();
    });

    it("returns empty for invalid input", () => {
      expect(parseSpotAssets(null, {}, 0)).toEqual([]);
      expect(parseSpotAssets("bad", {}, 0)).toEqual([]);
      expect(parseSpotAssets([], {}, 0)).toEqual([]);
    });
  });

  describe("extractSpotTokens", () => {
    it("extracts token names from spotMeta", () => {
      const raw = {
        tokens: [
          { name: "USDC", index: 0 },
          { name: "PURR", index: 1 },
          { name: "HFUN", index: 2 },
        ],
      };
      expect(extractSpotTokens(raw)).toEqual(["USDC", "PURR", "HFUN"]);
    });

    it("returns empty for invalid input", () => {
      expect(extractSpotTokens(null)).toEqual([]);
      expect(extractSpotTokens("bad")).toEqual([]);
      expect(extractSpotTokens({})).toEqual([]);
    });
  });

  describe("sortAndDedupeAssets", () => {
    const makePerp = (
      coin: string,
      rawCoin: string,
      dexPrefix: string | null,
      dayNtlVlm: string,
      isDelisted = false,
    ): PerpTradeAsset => ({
      ...baseAsset(coin, rawCoin, dexPrefix, dayNtlVlm),
      isDelisted,
      category: "perp",
      displayCategory: "Perp",
      marketType: "perp",
      markPx: "0",
      prevDayPx: "0",
      openInterest: "0",
      funding: "0",
      maxLeverage: 1,
      szDecimals: 0,
    });

    const makeSpot = (coin: string, rawCoin: string, dayNtlVlm: string): SpotTradeAsset => ({
      ...baseAsset(coin, rawCoin, null, dayNtlVlm),
      isDelisted: false,
      category: "spot",
      displayCategory: "Spot",
      marketType: "spot",
      markPx: "0",
      prevDayPx: "0",
      dayBaseVlm: "0",
      maxLeverage: 1,
      szDecimals: 0,
      openInterest: "0",
      funding: "0",
    });

    it("orders perps before spot", () => {
      const perp = makePerp("BTC", "BTC", null, "100");
      const spot = makeSpot("PURR", "PURR/USDC", "50");
      const result = sortAndDedupeAssets([perp], [spot]);
      expect(result[0].marketType).toBe("perp");
      expect(result[1].marketType).toBe("spot");
    });

    it("puts delisted items last", () => {
      const active = makePerp("BTC", "BTC", null, "100");
      const delisted = makePerp("OLD", "OLD", null, "0", true);
      const result = sortAndDedupeAssets([delisted, active], []);
      expect(result[0].rawCoin).toBe("BTC");
      expect(result[1].rawCoin).toBe("OLD");
    });

    it("prefers main dex (null) over builder for same rawCoin+type", () => {
      const builder = makePerp("YEETI", "xyz:YEETI", "xyz", "500");
      const main = makePerp("YEETI", "xyz:YEETI", null, "100");
      const result = sortAndDedupeAssets([builder, main], []);
      expect(result).toHaveLength(1);
      expect(result[0].dexPrefix).toBeNull();
    });

    it("sorts by volume descending within same marketType", () => {
      const high = makePerp("BTC", "BTC", null, "1000");
      const low = makePerp("ETH", "ETH", null, "100");
      const result = sortAndDedupeAssets([low, high], []);
      expect(result[0].rawCoin).toBe("BTC");
      expect(result[1].rawCoin).toBe("ETH");
    });
  });
});
