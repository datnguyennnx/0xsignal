/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import type { L2BookLevel } from "@/core/utils/hyperliquid";
import type { AssetCtxSnapshot } from "@/features/trade/lib/asset-ctx";
import { MAX_TRADE_TICKS, type TradeTick } from "@/features/trade/lib/trade-tick";

import {
  cancelMidsFlush,
  marketDataStoreInternals,
  useMarketDataStore,
  useTrades,
} from "./use-market-data-store";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * This test file lives outside the app tsconfig project, so store reads resolve
 * as `error` types under type-aware lint. Read the shape structurally instead.
 */
const bookLevelField = (
  symbol: string,
  side: "bids" | "asks",
  index: number,
  field: "price" | "size" | "total",
): unknown => {
  const rawState: unknown = useMarketDataStore.getState();
  if (!isRecord(rawState)) return undefined;
  const books = rawState["orderbookData"];
  if (!isRecord(books)) return undefined;
  const book = books[symbol];
  if (!isRecord(book)) return undefined;
  const levels = book[side];
  if (!Array.isArray(levels)) return undefined;
  const level: unknown = levels[index];
  return isRecord(level) ? level[field] : undefined;
};

const level = (price: number, size: number): L2BookLevel => ({
  px: String(price),
  sz: String(size),
  n: 1,
});

const bar = (time: number, close: number): ChartDataPoint => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 100,
});

const candles = (key: string): readonly ChartDataPoint[] =>
  useMarketDataStore.getState().candleData[key] ?? [];

describe("symbolFromCandleKey", () => {
  test("keeps every segment but the trailing interval or precision", () => {
    expect(marketDataStoreInternals.symbolFromCandleKey("xyz:YEETI:1m")).toBe("xyz:YEETI");
    expect(marketDataStoreInternals.symbolFromCandleKey("BTC:1m")).toBe("BTC");
    expect(marketDataStoreInternals.symbolFromCandleKey("PURR/USDC:1m")).toBe("PURR/USDC");
  });
});

describe("appendCandles", () => {
  beforeEach(() => {
    useMarketDataStore.setState({ candleData: {} });
  });

  test("merges a newer sorted batch without dropping history", () => {
    const key = "merge:1m";

    useMarketDataStore.setState({ candleData: { [key]: [bar(100, 10), bar(200, 20)] } });
    useMarketDataStore.getState().appendCandles(key, [bar(150, 15), bar(250, 25)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 150, 200, 250]);
  });

  test("keeps one bar per timestamp and lets the newer payload win", () => {
    const key = "dedupe:1m";

    useMarketDataStore.setState({ candleData: { [key]: [bar(100, 10), bar(200, 20)] } });
    useMarketDataStore.getState().appendCandles(key, [bar(200, 99), bar(300, 30)]);

    const result = candles(key);
    expect(result.map((candle) => candle.time)).toEqual([100, 200, 300]);
    expect(result[1]?.close).toBe(99);
  });

  test("replaces the last bar in place when the stream updates it", () => {
    const key = "last:1m";

    useMarketDataStore.setState({ candleData: { [key]: [bar(100, 10), bar(200, 20)] } });
    useMarketDataStore.getState().appendCandles(key, [bar(200, 21)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 200]);
    expect(candles(key)[1]?.close).toBe(21);
  });
});

describe("mergeHistoryCandles", () => {
  beforeEach(() => {
    useMarketDataStore.setState({ candleData: {} });
  });

  test("a history page cannot regress a live forming bar on an equal timestamp", () => {
    const key = "race:1m";

    // Live frames land first, then a fetch that was requested earlier resolves.
    useMarketDataStore.getState().appendCandles(key, [bar(100, 10), bar(200, 25)]);
    useMarketDataStore.getState().mergeHistoryCandles(key, [bar(100, 10), bar(200, 20)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 200]);
    expect(candles(key)[1]?.close).toBe(25);
  });

  test("an older history page prepends bars and keeps the live tail intact", () => {
    const key = "backfill:1m";

    useMarketDataStore.getState().appendCandles(key, [bar(300, 30), bar(400, 40)]);
    useMarketDataStore.getState().mergeHistoryCandles(key, [bar(100, 10), bar(200, 20)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 200, 300, 400]);
    expect(candles(key).at(-1)?.close).toBe(40);
  });

  test("an identity switch merges a history page over existing live frames", () => {
    const key = "switch:1m";

    useMarketDataStore.getState().appendCandles(key, [bar(300, 30)]);
    useMarketDataStore.getState().mergeHistoryCandles(key, [bar(100, 10), bar(300, 31)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 300]);
    // Not wiped, and the live bar's close survives the tie.
    expect(candles(key)[1]?.close).toBe(30);
  });

  test("uses the history array wholesale only when the key is empty", () => {
    const key = "fresh:1m";

    useMarketDataStore.getState().mergeHistoryCandles(key, [bar(100, 10), bar(200, 20)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 200]);
  });

  test("stays time-sorted and keeps one bar per timestamp", () => {
    const key = "dedupe:history:1m";

    useMarketDataStore.getState().mergeHistoryCandles(key, [bar(100, 10), bar(200, 20)]);
    useMarketDataStore
      .getState()
      .mergeHistoryCandles(key, [
        bar(50, 5),
        bar(100, 11),
        bar(100, 12),
        bar(200, 21),
        bar(200, 22),
      ]);

    const times = candles(key).map((candle) => candle.time);
    expect(times).toEqual([50, 100, 200]);
    expect(new Set(times).size).toBe(times.length);
  });
});

describe("orderbook flush gate", () => {
  type FrameCallback = (time: number) => void;

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: FrameCallback | null = null;

  const flushFrame = (): void => {
    const callback = pendingFrame;
    pendingFrame = null;
    callback?.(0);
  };

  beforeEach(() => {
    pendingFrame = null;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      pendingFrame = callback;
      return 1;
    };
    globalThis.cancelAnimationFrame = (): void => {
      pendingFrame = null;
    };
  });

  afterEach(() => {
    globalThis.cancelAnimationFrame(1);
    pendingFrame = null;
    useMarketDataStore.setState({ orderbookData: {} });
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("propagates a snapshot that only changes levels below the top of book", () => {
    const symbol = "GATE-DEEP";
    const bids = [level(100, 1), level(99, 2), level(98, 3)];
    const asks = [level(101, 1), level(102, 2)];

    useMarketDataStore.getState().applyOrderbookSnapshot(symbol, [bids, asks]);
    flushFrame();

    expect(bookLevelField(symbol, "bids", 2, "size")).toBe(3);

    const deeperBids = [level(100, 1), level(99, 2), level(98, 9)];
    useMarketDataStore.getState().applyOrderbookSnapshot(symbol, [deeperBids, asks]);
    flushFrame();

    expect(bookLevelField(symbol, "bids", 2, "size")).toBe(9);
    expect(bookLevelField(symbol, "bids", 2, "total")).toBe(12);
  });

  test("sorts a shuffled snapshot and recomputes totals in order", () => {
    const symbol = "ORDERING";

    useMarketDataStore.getState().applyOrderbookSnapshot(symbol, [
      [level(101, 5), level(99, 1), level(100, 2)],
      [level(103, 1), level(102, 2)],
    ]);
    flushFrame();

    expect(bookLevelField(symbol, "bids", 0, "price")).toBe(101);
    expect(bookLevelField(symbol, "bids", 1, "price")).toBe(100);
    expect(bookLevelField(symbol, "bids", 2, "price")).toBe(99);
    expect(bookLevelField(symbol, "bids", 0, "total")).toBe(5);
    expect(bookLevelField(symbol, "bids", 1, "total")).toBe(7);
    expect(bookLevelField(symbol, "asks", 0, "price")).toBe(102);
    expect(bookLevelField(symbol, "asks", 1, "price")).toBe(103);
  });
});

describe("orderbook symbol LRU", () => {
  type FrameCallback = (time: number) => void;

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: FrameCallback | null = null;
  const liveSymbols: string[] = [];

  const flushFrame = (): void => {
    const callback = pendingFrame;
    pendingFrame = null;
    callback?.(0);
  };

  const seedBook = (symbol: string): void => {
    useMarketDataStore
      .getState()
      .applyOrderbookSnapshot(symbol, [[level(100, 1)], [level(101, 1)]]);
    flushFrame();
  };

  const mountBook = (symbol: string): void => {
    marketDataStoreInternals.retainOrderbookSubscriber(symbol);
    liveSymbols.push(symbol);
    seedBook(symbol);
  };

  beforeEach(() => {
    pendingFrame = null;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      pendingFrame = callback;
      return 1;
    };
    globalThis.cancelAnimationFrame = (): void => {
      pendingFrame = null;
    };
    useMarketDataStore.setState({ orderbookData: {} });
  });

  afterEach(() => {
    for (const symbol of liveSymbols.splice(0)) {
      marketDataStoreInternals.releaseOrderbookSubscriber(symbol);
    }
    useMarketDataStore.setState({ orderbookData: {}, allMids: {} });
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("declines a newcomer instead of leaking state when every tracked book is live", () => {
    const live = ["LRU-A", "LRU-B", "LRU-C", "LRU-D", "LRU-E", "LRU-F"];
    for (const symbol of live) mountBook(symbol);

    expect(marketDataStoreInternals.rawOrderbookSymbolCount()).toBe(6);
    expect(marketDataStoreInternals.trackedOrderbookSymbols()).toEqual(live);

    seedBook("LRU-NEW");

    // Every retained raw book still has bookkeeping, so the count cannot exceed
    // the cap minus whatever is live; the newcomer is not admitted.
    expect(marketDataStoreInternals.rawOrderbookSymbolCount()).toBe(
      marketDataStoreInternals.trackedOrderbookSymbols().length,
    );
    expect(marketDataStoreInternals.rawOrderbookSymbolCount()).toBe(6);
    expect(marketDataStoreInternals.trackedOrderbookSymbols()).not.toContain("LRU-NEW");
    expect(useMarketDataStore.getState().orderbookData["LRU-NEW"]).toBeUndefined();

    for (const symbol of live) {
      expect(useMarketDataStore.getState().orderbookData[symbol]?.bids).toHaveLength(1);
    }
  });

  test("deletes raw and display state for the inactive symbol it evicts", () => {
    const symbols = ["EV-A", "EV-B", "EV-C", "EV-D", "EV-E", "EV-F", "EV-G"];
    for (const symbol of symbols) seedBook(symbol);

    expect(marketDataStoreInternals.rawOrderbookSymbolCount()).toBe(6);
    expect(marketDataStoreInternals.trackedOrderbookSymbols()).not.toContain("EV-A");
    expect(useMarketDataStore.getState().orderbookData["EV-A"]).toBeUndefined();
  });

  test("retiring a candle key evicts every orderbook precision for that symbol", () => {
    seedBook("KEEP:raw");
    seedBook("RETIRE:raw");
    seedBook("RETIRE:100");

    expect(useMarketDataStore.getState().orderbookData["RETIRE:raw"]).toBeDefined();
    expect(useMarketDataStore.getState().orderbookData["RETIRE:100"]).toBeDefined();

    // Push the symbol's only candle key out of the four-key window.
    useMarketDataStore.getState().appendCandles("RETIRE:1m", [bar(1, 1)]);
    for (const other of ["PUSH-1", "PUSH-2", "PUSH-3", "PUSH-4"]) {
      useMarketDataStore.getState().appendCandles(`${other}:1m`, [bar(1, 1)]);
    }

    expect(useMarketDataStore.getState().orderbookData["RETIRE:raw"]).toBeUndefined();
    expect(useMarketDataStore.getState().orderbookData["RETIRE:100"]).toBeUndefined();
    expect(useMarketDataStore.getState().orderbookData["KEEP:raw"]).toBeDefined();
  });

  test("retiring a HIP-3 candle key leaves sibling HIP-3 books intact", () => {
    seedBook("xyz:YEETI:5");
    seedBook("xyz:CVX:5");
    seedBook("BTC:5");

    useMarketDataStore.getState().appendCandles("xyz:YEETI:1m", [bar(1, 1)]);
    for (const other of ["PUSH-1", "PUSH-2", "PUSH-3", "PUSH-4"]) {
      useMarketDataStore.getState().appendCandles(`${other}:1m`, [bar(1, 1)]);
    }

    expect(useMarketDataStore.getState().orderbookData["xyz:YEETI:5"]).toBeUndefined();
    expect(useMarketDataStore.getState().orderbookData["xyz:CVX:5"]).toBeDefined();
    expect(useMarketDataStore.getState().orderbookData["BTC:5"]).toBeDefined();
  });

  test("retiring a plain candle key does not sweep HIP-3 books", () => {
    seedBook("xyz:YEETI:5");
    seedBook("BTC:5");

    useMarketDataStore.getState().appendCandles("BTC:1m", [bar(1, 1)]);
    for (const other of ["PUSH-1", "PUSH-2", "PUSH-3", "PUSH-4"]) {
      useMarketDataStore.getState().appendCandles(`${other}:1m`, [bar(1, 1)]);
    }

    expect(useMarketDataStore.getState().orderbookData["BTC:5"]).toBeUndefined();
    expect(useMarketDataStore.getState().orderbookData["xyz:YEETI:5"]).toBeDefined();
  });
});

describe("page visibility flush gate", () => {
  type FrameCallback = (time: number) => void;

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: FrameCallback | null = null;

  const visibilityListeners = new Set<() => void>();
  const fakeDocument = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener(type: string, listener: () => void): void {
      if (type === "visibilitychange") visibilityListeners.add(listener);
    },
    removeEventListener(type: string, listener: () => void): void {
      if (type === "visibilitychange") visibilityListeners.delete(listener);
    },
  };

  const setVisibility = (visibilityState: DocumentVisibilityState): void => {
    fakeDocument.visibilityState = visibilityState;
    for (const listener of visibilityListeners) listener();
  };

  const flushFrame = (): void => {
    const callback = pendingFrame;
    pendingFrame = null;
    callback?.(0);
  };

  /** Count writes that actually replace the orderbook slice. */
  const countOrderbookCommits = (): { count: () => number; stop: () => void } => {
    let commits = 0;
    const stop = useMarketDataStore.subscribe((state, previous) => {
      if (state.orderbookData !== previous.orderbookData) commits++;
    });
    return { count: () => commits, stop };
  };

  /** Count writes that actually replace the mids slice. */
  const countMidsCommits = (): { count: () => number; stop: () => void } => {
    let commits = 0;
    const stop = useMarketDataStore.subscribe((state, previous) => {
      if (state.allMids !== previous.allMids) commits++;
    });
    return { count: () => commits, stop };
  };

  beforeEach(() => {
    pendingFrame = null;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      pendingFrame = callback;
      return 1;
    };
    globalThis.cancelAnimationFrame = (): void => {
      pendingFrame = null;
    };
    fakeDocument.visibilityState = "visible";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: fakeDocument,
    });
    useMarketDataStore.setState({ orderbookData: {}, allMids: {} });
  });

  afterEach(() => {
    setVisibility("visible");
    flushFrame();
    cancelMidsFlush();
    pendingFrame = null;
    useMarketDataStore.setState({ orderbookData: {}, allMids: {} });
    Reflect.deleteProperty(globalThis, "document");
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("defers a dirty orderbook until visible and commits it exactly once", () => {
    const symbol = "VIS-BOOK";

    useMarketDataStore
      .getState()
      .applyOrderbookSnapshot(symbol, [[level(100, 1)], [level(101, 1)]]);
    expect(pendingFrame).not.toBeNull();

    setVisibility("hidden");
    expect(pendingFrame).toBeNull();

    useMarketDataStore
      .getState()
      .applyOrderbookSnapshot(symbol, [[level(100, 2)], [level(101, 1)]]);
    // Hidden frames never schedule a paint and never commit.
    expect(pendingFrame).toBeNull();
    expect(useMarketDataStore.getState().orderbookData[symbol]).toBeUndefined();

    // A second hidden notification must not flush anything.
    setVisibility("hidden");
    expect(useMarketDataStore.getState().orderbookData[symbol]).toBeUndefined();

    const commits = countOrderbookCommits();
    setVisibility("visible");

    expect(commits.count()).toBe(1);
    expect(bookLevelField(symbol, "bids", 0, "size")).toBe(2);
    commits.stop();

    // The deferred update resumed normal scheduling: the next frame is queued.
    useMarketDataStore.getState().applyOrderbookDelta(symbol, [level(100, 3)], []);
    expect(pendingFrame).not.toBeNull();
  });

  test("defers the latest mids snapshot until visible and commits it exactly once", () => {
    useMarketDataStore.getState().setAllMids({ BTC: 1 });
    expect(pendingFrame).not.toBeNull();

    setVisibility("hidden");
    expect(pendingFrame).toBeNull();

    useMarketDataStore.getState().setAllMids({ BTC: 2 });
    expect(pendingFrame).toBeNull();
    expect(useMarketDataStore.getState().allMids).toEqual({});

    setVisibility("hidden");
    expect(useMarketDataStore.getState().allMids).toEqual({});

    const commits = countMidsCommits();
    setVisibility("visible");

    expect(commits.count()).toBe(1);
    expect(useMarketDataStore.getState().allMids).toEqual({ BTC: 2 });
    commits.stop();
  });
});

describe("allMids flush cancellation", () => {
  type FrameCallback = (time: number) => void;

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: FrameCallback | null = null;

  const flushFrame = (): void => {
    const callback = pendingFrame;
    pendingFrame = null;
    callback?.(0);
  };

  beforeEach(() => {
    pendingFrame = null;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      pendingFrame = callback;
      return 1;
    };
    globalThis.cancelAnimationFrame = (): void => {
      pendingFrame = null;
    };
    useMarketDataStore.setState({ allMids: {} });
  });

  afterEach(() => {
    cancelMidsFlush();
    pendingFrame = null;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("a cancelled frame that still fires commits nothing", () => {
    // Some hosts keep the callback even after cancelAnimationFrame; clearing the
    // pending snapshot must be enough to make it a no-op.
    globalThis.cancelAnimationFrame = (): void => {};
    useMarketDataStore.getState().setAllMids({ BTC: 1 });

    cancelMidsFlush();
    expect(pendingFrame).not.toBeNull();

    flushFrame();
    expect(useMarketDataStore.getState().allMids).toEqual({});
  });

  test("drops the queued frame and the pending snapshot, and is idempotent", () => {
    useMarketDataStore.getState().setAllMids({ BTC: 1 });
    expect(pendingFrame).not.toBeNull();

    cancelMidsFlush();
    expect(pendingFrame).toBeNull();

    flushFrame();
    expect(useMarketDataStore.getState().allMids).toEqual({});

    expect(() => cancelMidsFlush()).not.toThrow();

    useMarketDataStore.getState().setAllMids({ BTC: 2 });
    flushFrame();
    expect(useMarketDataStore.getState().allMids).toEqual({ BTC: 2 });
  });
});

describe("applyAssetCtx", () => {
  const snapshot = (markPx: number): AssetCtxSnapshot => ({
    markPx,
    prevDayPx: 92620,
    funding: 0.00000625,
    dayNtlVlm: 563592476.12,
    openInterest: 2175,
    oraclePx: 93730,
  });

  const stored = (coin: string): AssetCtxSnapshot | undefined =>
    useMarketDataStore.getState().assetCtx[coin];

  beforeEach(() => {
    useMarketDataStore.setState({ assetCtx: {} });
  });

  test("stores a snapshot under its coin key", () => {
    const next = snapshot(93732);

    useMarketDataStore.getState().applyAssetCtx("xyz:BTC", next);

    expect(stored("xyz:BTC")).toBe(next);
  });

  test("an equal snapshot keeps the previous object reference", () => {
    const first = snapshot(93732);

    useMarketDataStore.getState().applyAssetCtx("xyz:BTC", first);
    useMarketDataStore.getState().applyAssetCtx("xyz:BTC", snapshot(93732));

    expect(stored("xyz:BTC")).toBe(first);
  });

  test("a changed mark price replaces only that coin's key", () => {
    const btc = snapshot(93732);
    const eth = snapshot(3100);

    useMarketDataStore.getState().applyAssetCtx("xyz:BTC", btc);
    useMarketDataStore.getState().applyAssetCtx("xyz:ETH", eth);
    const before = useMarketDataStore.getState().assetCtx;

    useMarketDataStore.getState().applyAssetCtx("xyz:BTC", snapshot(93740));
    const after = useMarketDataStore.getState().assetCtx;

    expect(after).not.toBe(before);
    expect(after["xyz:BTC"]).not.toBe(btc);
    expect(after["xyz:BTC"]?.markPx).toBe(93740);
    expect(after["xyz:ETH"]).toBe(eth);
  });

  test("an unknown coin is undefined", () => {
    expect(stored("xyz:SOL")).toBeUndefined();
  });
});

describe("applyAssetCtxBatch", () => {
  const snapshot = (markPx: number): AssetCtxSnapshot => ({
    markPx,
    prevDayPx: 92620,
    funding: 0.00000625,
    dayNtlVlm: 563592476.12,
    openInterest: 2175,
    oraclePx: 93730,
  });

  /** Count writes that actually replace the assetCtx slice. */
  const countAssetCtxCommits = (): { count: () => number; stop: () => void } => {
    let commits = 0;
    const stop = useMarketDataStore.subscribe((state, previous) => {
      if (state.assetCtx !== previous.assetCtx) commits++;
    });
    return { count: () => commits, stop };
  };

  beforeEach(() => {
    useMarketDataStore.setState({ assetCtx: {} });
  });

  test("three coins in one batch commit once and store every value", () => {
    const commits = countAssetCtxCommits();

    useMarketDataStore.getState().applyAssetCtxBatch([
      ["xyz:BTC", snapshot(93732)],
      ["xyz:ETH", snapshot(3100)],
      ["xyz:SOL", snapshot(180)],
    ]);

    expect(commits.count()).toBe(1);
    expect(useMarketDataStore.getState().assetCtx["xyz:BTC"]?.markPx).toBe(93732);
    expect(useMarketDataStore.getState().assetCtx["xyz:ETH"]?.markPx).toBe(3100);
    expect(useMarketDataStore.getState().assetCtx["xyz:SOL"]?.markPx).toBe(180);
    commits.stop();
  });

  test("a batch equal to current state commits nothing and keeps the reference", () => {
    const btc = snapshot(93732);
    const eth = snapshot(3100);
    useMarketDataStore.setState({ assetCtx: { "xyz:BTC": btc, "xyz:ETH": eth } });
    const before = useMarketDataStore.getState().assetCtx;
    const commits = countAssetCtxCommits();

    useMarketDataStore.getState().applyAssetCtxBatch([
      ["xyz:BTC", snapshot(93732)],
      ["xyz:ETH", snapshot(3100)],
    ]);

    expect(commits.count()).toBe(0);
    expect(useMarketDataStore.getState().assetCtx).toBe(before);
    commits.stop();
  });

  test("a mixed batch commits once and replaces only the changed coin", () => {
    const btc = snapshot(93732);
    useMarketDataStore.setState({ assetCtx: { "xyz:BTC": btc } });
    const commits = countAssetCtxCommits();

    useMarketDataStore.getState().applyAssetCtxBatch([
      ["xyz:BTC", snapshot(93732)],
      ["xyz:ETH", snapshot(3100)],
    ]);

    expect(commits.count()).toBe(1);
    expect(useMarketDataStore.getState().assetCtx["xyz:BTC"]).toBe(btc);
    expect(useMarketDataStore.getState().assetCtx["xyz:ETH"]?.markPx).toBe(3100);
    commits.stop();
  });
});

describe("pushTrades", () => {
  const tick = (tid: number, side: "buy" | "sell" = "buy"): TradeTick => ({
    px: 74000 + tid,
    sz: 0.1,
    time: 1_794_388_497_000 + tid,
    side,
    hash: `0x${tid.toString(16)}`,
    tid,
  });

  const tape = (coin: string): readonly TradeTick[] | undefined =>
    useMarketDataStore.getState().trades[coin];

  /** Count writes that actually replace the trades slice. */
  const countTradeCommits = (): { count: () => number; stop: () => void } => {
    let commits = 0;
    const stop = useMarketDataStore.subscribe((state, previous) => {
      if (state.trades !== previous.trades) commits++;
    });
    return { count: () => commits, stop };
  };

  beforeEach(() => {
    useMarketDataStore.setState({ trades: {} });
  });

  test("orders the tape newest first across two ascending batches", () => {
    useMarketDataStore.getState().pushTrades("BTC", [tick(1), tick(2), tick(3)]);
    useMarketDataStore.getState().pushTrades("BTC", [tick(4), tick(5)]);

    expect(tape("BTC")?.map((entry) => entry.tid)).toEqual([5, 4, 3, 2, 1]);
  });

  test("re-sorts a batch that mixes an older tick between newer ones", () => {
    useMarketDataStore.getState().pushTrades("BTC", [tick(2)]);
    useMarketDataStore.getState().pushTrades("BTC", [tick(4), tick(1), tick(3)]);

    expect(tape("BTC")?.map((entry) => entry.tid)).toEqual([4, 3, 2, 1]);
  });

  test("re-delivering the same batch adds nothing and keeps the array reference", () => {
    useMarketDataStore.getState().pushTrades("BTC", [tick(1), tick(2)]);
    const before = tape("BTC");
    const commits = countTradeCommits();

    useMarketDataStore.getState().pushTrades("BTC", [tick(1), tick(2)]);

    expect(tape("BTC")).toBe(before);
    expect(commits.count()).toBe(0);
    commits.stop();
  });

  test("one batch is one write", () => {
    const commits = countTradeCommits();

    useMarketDataStore.getState().pushTrades("BTC", [tick(1), tick(2), tick(3)]);

    expect(commits.count()).toBe(1);
    expect(tape("BTC")).toHaveLength(3);
    commits.stop();
  });

  test("caps the tape at MAX_TRADE_TICKS and drops the oldest tick", () => {
    const newestFirst = Array.from({ length: MAX_TRADE_TICKS + 10 }, (_, index) =>
      tick(MAX_TRADE_TICKS + 10 - index),
    );

    useMarketDataStore.getState().pushTrades("BTC", newestFirst);

    const result = tape("BTC") ?? [];
    expect(result).toHaveLength(MAX_TRADE_TICKS);
    expect(result[0]?.tid).toBe(MAX_TRADE_TICKS + 10);
    expect(result.at(-1)?.tid).toBe(11);
  });

  test("an unknown coin is undefined", () => {
    expect(tape("NOPE")).toBeUndefined();
  });

  test("exposes the per-coin tape selector", () => {
    expect(typeof useTrades).toBe("function");
  });
});
