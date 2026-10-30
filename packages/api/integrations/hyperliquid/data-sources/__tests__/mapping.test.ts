import { describe, it, expect, vi } from "vitest";
import { Cause, Effect, Exit, Option, Result } from "effect";
import { getTickerSnapshot } from "../mapping";
import { HyperliquidError } from "../errors";
import { layerUnlimited as rateLimiterUnlimited } from "../../rate-limit";
import {
  mapTickerFromSnapshot,
  resolveInternalSymbol,
  parsePerpAssets,
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

const parsePerpFixture = (dexName: string, dexIdx: number, universe: Record<string, unknown>[]) =>
  parsePerpAssets(dexName, dexIdx, [{ universe }, []], {}, new Map(), []);

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
      expect(Result.getOrThrow(resolveInternalSymbol(mockSnapshot, "PARA:BTCD"))).toBe("para:BTCD");
    });

    it("should fail with NOT_FOUND instead of passing an unknown symbol through", () => {
      const error = failureOf(resolveInternalSymbol(mockSnapshot, "ETH"));
      expect(error).toMatchObject({ _tag: "TickerSnapshotError", kind: "NOT_FOUND" });
      expect(error.message).toContain("Symbol not found: ETH");
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

    it("should fail the snapshot on a rate-limited metadata fetch, not degrade to empty", async () => {
      mockInfo.perpDexs.mockResolvedValue([]);
      mockInfo.metaAndAssetCtxs.mockRejectedValue(
        new HyperliquidError({ message: "rate limited", kind: "RATE_LIMITED" }),
      );

      const exit = await Effect.runPromiseExit(
        Effect.provide(getTickerSnapshot(mockInfo), rateLimiterUnlimited),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      const cause = Option.getOrThrow(
        Exit.match(exit, {
          onSuccess: () => Option.none<Cause.Cause<HyperliquidError>>(),
          onFailure: (value) => Option.some(value),
        }),
      );
      const failures = cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error);
      expect(failures).toContainEqual(expect.objectContaining({ kind: "RATE_LIMITED" }));
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
      expect(Result.getOrThrow(resolveInternalSymbol(mockSnapshot, "PARA:BTCD-USDT"))).toBe(
        "para:BTCD",
      );
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

    it("emits every pair, including a zero-volume one", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids);
      // Zero volume is not a delisting: LICK (vol=0) is still tradable.
      expect(result.map((a) => a.coin)).toEqual(["PURR", "HFUN", "LICK"]);
    });

    it("sets the id from 10000 + the pair universe index", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids);
      expect(result.map((a) => a.assetId)).toEqual([10000, 10001, 10002]);
    });

    it("resolves token names and quote currency correctly", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids);

      const hfun = result.find((a) => a.coin === "HFUN")!;
      expect(hfun.rawCoin).toBe("HFUN/USDC");
      expect(hfun.displaySymbol).toBe("HFUN/USDC");
      // The wire identifier streams under "@1"; only the display name is rebuilt.
      expect(hfun.name).toBe("@1");
      expect(hfun.quoteCurrency).toBe("USDC");
      expect(hfun.marketType).toBe("spot");
    });

    it("builds the display name from the token pair, never the @N query name", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids);

      const hfun = result.find((a) => a.coin === "HFUN")!;
      expect(hfun.displaySymbol).toBe("HFUN/USDC");
      expect(hfun.displaySymbol).not.toBe("@1");
      // A readable upstream name is kept as-is.
      expect(result.find((a) => a.coin === "PURR")?.displaySymbol).toBe("PURR/USDC");
    });

    it("reads prices from allMids using entry.name", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids);

      const purr = result.find((a) => a.coin === "PURR")!;
      expect(purr.markPx).toBe("0.0895"); // from allMids["PURR/USDC"]

      const hfun = result.find((a) => a.coin === "HFUN")!;
      expect(hfun.markPx).toBe("10.05"); // from allMids["@1"]
    });

    it("falls back to ctx fields when allMids missing", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, {});

      const purr = result.find((a) => a.coin === "PURR")!;
      expect(purr.markPx).toBe("0.09"); // from ctx.markPx
    });

    it("keeps a zero-volume pair with its volume intact", () => {
      const raw = [{ universe: spotUniverse, tokens: spotTokens }, assetCtxs];
      const result = parseSpotAssets(raw, allMids);
      const lick = result.find((a) => a.coin === "LICK");
      expect(lick).toBeDefined();
      expect(lick?.dayNtlVlm).toBe("0");
    });

    it("returns empty for invalid input", () => {
      expect(parseSpotAssets(null, {})).toEqual([]);
      expect(parseSpotAssets("bad", {})).toEqual([]);
      expect(parseSpotAssets([], {})).toEqual([]);
    });
  });

  describe("parsePerpAssets", () => {
    it("sets a main-dex id from its position in the universe", () => {
      const result = parsePerpFixture("", 0, [{ name: "BTC" }, { name: "ETH" }]);
      expect(result.map((a) => a.assetId)).toEqual([0, 1]);
    });

    it("does not shift later ids when an entry has an empty name", () => {
      const result = parsePerpFixture("", 0, [{ name: "BTC" }, { name: "" }, { name: "ETH" }]);
      expect(result.map((a) => [a.coin, a.assetId])).toEqual([
        ["BTC", 0],
        ["ETH", 2],
      ]);
    });

    it("sets a builder-dex id from 100000 + perpDexs position * 10000 + universe index", () => {
      const result = parsePerpFixture("xyz", 1, [{ name: "EUR" }, { name: "TSLA" }]);
      expect(result.map((a) => a.assetId)).toEqual([110000, 110001]);
    });

    it("keeps every id inside its market band", () => {
      const main = parsePerpFixture("", 0, [{ name: "BTC" }]);
      const builder = parsePerpFixture("xyz", 1, [{ name: "EUR" }]);
      const spot = parseSpotAssets(
        [
          {
            universe: [{ tokens: [1, 0], name: "@1", index: 3 }],
            tokens: [{ name: "USDC" }, { name: "HYPE" }],
          },
          [],
        ],
        {},
      );

      for (const asset of main) expect(asset.assetId).toBeLessThan(10000);
      for (const asset of builder) {
        expect(asset.assetId).toBeGreaterThanOrEqual(110000);
        expect(asset.assetId).toBeLessThan(100000000);
      }
      for (const asset of spot) {
        expect(asset.assetId).toBeGreaterThanOrEqual(10000);
        expect(asset.assetId).toBeLessThan(100000);
      }
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
