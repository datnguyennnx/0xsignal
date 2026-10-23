import { describe, expect, it, vi } from "vitest";
import { Cache, Effect } from "effect";
import type { HyperliquidInfoClient } from "../../../infrastructure/data-sources/hyperliquid/types";
import {
  getTickerSnapshot,
  tickerSnapshotCacheKey,
} from "../../../infrastructure/data-sources/hyperliquid/mapping";
import {
  TICKER_SNAPSHOT_CACHE_CAPACITY,
  TICKER_SNAPSHOT_TTL_MS,
  makeTickerSnapshotCache,
  readTickerSnapshot,
} from "../../../infrastructure/data-sources/hyperliquid/provider";

const makeInfo = (): HyperliquidInfoClient => ({
  allMids: vi.fn<HyperliquidInfoClient["allMids"]>().mockResolvedValue({ BTC: "100" }),
  metaAndAssetCtxs: vi
    .fn<HyperliquidInfoClient["metaAndAssetCtxs"]>()
    .mockResolvedValue([{ universe: [{ name: "BTC" }] }, [{ midPx: "100" }]]),
  perpDexs: vi.fn<NonNullable<HyperliquidInfoClient["perpDexs"]>>().mockResolvedValue([]),
});

describe("ticker snapshot coalescing and TTL cache", () => {
  it("coalesces concurrent identical reads into one upstream request", async () => {
    const info = makeInfo();
    const cache = await Effect.runPromise(makeTickerSnapshotCache(info));

    const [first, second] = await Effect.runPromise(
      Effect.all([readTickerSnapshot(cache, "BTC"), readTickerSnapshot(cache, "BTC")], {
        concurrency: "unbounded",
      }),
    );

    expect(info.allMids).toHaveBeenCalledTimes(1);
    expect(info.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("shares in-flight upstream reads across different symbols", async () => {
    const info = makeInfo();

    await Effect.runPromise(
      Effect.all([getTickerSnapshot(info, "BTC"), getTickerSnapshot(info, "xyz:ABC")], {
        concurrency: "unbounded",
      }),
    );

    expect(info.allMids).toHaveBeenCalledTimes(1);
    expect(info.metaAndAssetCtxs).toHaveBeenCalledTimes(2);
  });

  it("serves repeat reads inside the TTL without hitting upstream", async () => {
    const info = makeInfo();
    const cache = await Effect.runPromise(makeTickerSnapshotCache(info));

    await Effect.runPromise(readTickerSnapshot(cache, "BTC"));
    await Effect.runPromise(readTickerSnapshot(cache, "ETH"));

    expect(info.allMids).toHaveBeenCalledTimes(1);
    expect(info.metaAndAssetCtxs).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache on the fresh path and refreshes it", async () => {
    const info = makeInfo();
    const cache = await Effect.runPromise(makeTickerSnapshotCache(info));

    await Effect.runPromise(readTickerSnapshot(cache, "BTC"));
    await Effect.runPromise(readTickerSnapshot(cache, "BTC", { fresh: true }));

    expect(info.allMids).toHaveBeenCalledTimes(2);
    expect(info.metaAndAssetCtxs).toHaveBeenCalledTimes(2);

    await Effect.runPromise(readTickerSnapshot(cache, "BTC"));
    expect(info.metaAndAssetCtxs).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest snapshot at capacity", async () => {
    const info = makeInfo();
    const cache = await Effect.runPromise(
      makeTickerSnapshotCache(info, { capacity: 2, timeToLive: "1 hour" }),
    );

    await Effect.runPromise(
      Effect.all(
        ["a", "b", "c"].map((dex) => readTickerSnapshot(cache, `${dex}:COIN`)),
        { concurrency: 1 },
      ),
    );

    expect(await Effect.runPromise(Cache.size(cache))).toBe(2);
    expect(await Effect.runPromise(Cache.has(cache, tickerSnapshotCacheKey("a:COIN")))).toBe(false);
    expect(await Effect.runPromise(Cache.has(cache, tickerSnapshotCacheKey("c:COIN")))).toBe(true);
  });

  it("keeps the production bounds short and explicit", () => {
    expect(TICKER_SNAPSHOT_TTL_MS).toBeGreaterThanOrEqual(250);
    expect(TICKER_SNAPSHOT_TTL_MS).toBeLessThanOrEqual(1000);
    expect(TICKER_SNAPSHOT_CACHE_CAPACITY).toBeGreaterThan(0);
    expect(TICKER_SNAPSHOT_CACHE_CAPACITY).toBeLessThanOrEqual(256);
  });
});
