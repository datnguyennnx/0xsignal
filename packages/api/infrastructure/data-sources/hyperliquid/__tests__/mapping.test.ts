import { describe, it, expect, vi } from "vitest";
import { Deferred, Effect, Ref } from "effect";
import { getTickerSnapshotEffect } from "../mapping";
import { mapTickerFromSnapshot, resolveInternalSymbol } from "../mapping.pure";
import { HyperliquidRateLimiter } from "../rate-limiter";
import { HyperliquidDeduplicationRegistry } from "../dedup";

describe("Hyperliquid Mapping", () => {
  const mockInfo = {
    metaAndAssetCtxs: vi.fn().mockResolvedValue([null, null]),
    allMids: vi.fn().mockResolvedValue({}),
    perpCategories: vi.fn().mockResolvedValue([]),
    perpDexs: vi.fn().mockResolvedValue([]),
  } as any;

  describe("mapTickerFromSnapshot", () => {
    const mockSnapshot = {
      universe: [{ name: "BTC", maxLeverage: 50 }],
      assetCtxs: [{ midPx: "50000", markPx: "50005" }],
      allMids: { BTC: "50000" },
    } as any;

    it("should map standard perp ticker correctly", () => {
      const result = mapTickerFromSnapshot(mockSnapshot, "BTC");
      expect(result.symbol).toBe("BTC");
      expect(result.mid).toBe(50000);
      expect(result.markPx).toBe(50005);
    });

    it("should throw NOT_FOUND for unknown symbol", () => {
      expect(() => mapTickerFromSnapshot(mockSnapshot, "UNKNOWN")).toThrow(/Symbol not found/);
    });
  });

  describe("resolveInternalSymbol", () => {
    const mockSnapshot = {
      universe: [{ name: "para:BTCD" }],
    } as any;

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

      const semaphore = Effect.unsafeMakeSemaphore(6);
      const dedupRef = Ref.unsafeMake(new Map<string, Deferred.Deferred<any, unknown>>());
      const program = getTickerSnapshotEffect(mockInfo).pipe(
        Effect.provideService(HyperliquidRateLimiter, { semaphore }),
        Effect.provideService(HyperliquidDeduplicationRegistry, {
          registryRef: dedupRef,
        })
      );
      const result = await Effect.runPromise(program);

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

      const semaphore = Effect.unsafeMakeSemaphore(6);
      const dedupRef = Ref.unsafeMake(new Map<string, Deferred.Deferred<any, unknown>>());
      const program = getTickerSnapshotEffect(mockInfo).pipe(
        Effect.provideService(HyperliquidRateLimiter, { semaphore }),
        Effect.provideService(HyperliquidDeduplicationRegistry, {
          registryRef: dedupRef,
        })
      );
      const result = await Effect.runPromise(program);

      expect(result.universe).toHaveLength(1); // Only main DEX succeeded
      expect(result.universe[0].name).toBe("BTC");
    });
  });

  describe("resolveInternalSymbol with normalization", () => {
    const mockSnapshot = {
      universe: [{ name: "para:BTCD" }],
    } as any;

    it("should resolve with different casing and suffix", () => {
      // PARA:BTCD-USDT should normalize to para:BTCD and match
      expect(resolveInternalSymbol(mockSnapshot, "PARA:BTCD-USDT")).toBe("para:BTCD");
    });
  });
});
