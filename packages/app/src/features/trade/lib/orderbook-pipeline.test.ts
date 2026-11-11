import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readBookLeg, readBookSnapshot } from "./l2-book-merge";
import { orderbookStoreKey } from "./orderbook-book";
import { useMarketDataStore } from "@/stores/use-market-data-store";
import { DEFAULT_SIG_FIGS } from "@/core/utils/formatters";
import { processRawL2Levels, type L2BookLevel, type OrderbookData } from "@/core/utils/hyperliquid";
import { hasRenderableBook } from "../utils/orderbook-widget-shared";
import { createDirectMarketStream, toMarketFrame, type DirectMarketSink } from "./hl-market-stream";

const CAPTURED = {
  channel: "l2Book",
  data: {
    coin: "BTC",
    time: 1794384366062,
    levels: [
      [
        { px: "74049.0", sz: "7.79", n: 17 },
        { px: "74048.0", sz: "1.5", n: 4 },
        { px: "74000.0", sz: "2.25", n: 3 },
      ],
      [
        { px: "74050.0", sz: "0.4", n: 2 },
        { px: "74051.0", sz: "1.1", n: 5 },
        { px: "74100.0", sz: "3.0", n: 6 },
      ],
    ],
    spread: "1.0",
  },
};

const FAST_CAPTURED = {
  channel: "l2Book",
  data: {
    ...CAPTURED.data,
    fast: true,
  },
};

type CapturedData = {
  levels: [L2BookLevel[], L2BookLevel[]];
};

const capturedLevels = (): [L2BookLevel[], L2BookLevel[]] => {
  const data = CAPTURED.data as unknown as CapturedData;
  return [[...data.levels[0]], [...data.levels[1]]];
};

const prices = (levels: readonly { price: number }[]): number[] =>
  levels.map((level) => level.price);

describe("l2Book pipeline", () => {
  let pendingFrame: FrameRequestCallback | null = null;
  const originalRaf = globalThis.requestAnimationFrame;

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
    useMarketDataStore.setState({ orderbookData: {} });
  });

  afterEach(() => {
    flushFrame();
    useMarketDataStore.setState({ orderbookData: {} });
    globalThis.requestAnimationFrame = originalRaf;
  });

  test("readBookSnapshot reads the captured envelope and the bare payload identically", () => {
    const envelope = readBookSnapshot(CAPTURED);
    const bare = readBookSnapshot(CAPTURED.data);

    expect(envelope).not.toBeNull();
    expect(bare).not.toBeNull();
    expect(envelope?.levels[0]).toEqual(CAPTURED.data.levels[0]);
    expect(envelope?.levels[1]).toEqual(CAPTURED.data.levels[1]);
    expect(envelope?.time).toBe(CAPTURED.data.time);
    expect(bare?.levels).toEqual(envelope?.levels);
  });

  test("readBookLeg keeps the wire time and fast marker", () => {
    const fast = readBookLeg(FAST_CAPTURED);
    expect(fast?.time).toBe(FAST_CAPTURED.data.time);
    expect(fast?.fast).toBe(true);
    expect(fast?.coin).toBe("BTC");
    expect(fast?.levels[0]).toHaveLength(3);

    const slow = readBookLeg(CAPTURED);
    expect(slow?.fast).toBeUndefined();
    expect(slow?.time).toBe(CAPTURED.data.time);
  });

  test("toMarketFrame propagates time and degraded for a merged book", () => {
    const levelsPair: [unknown[], unknown[]] = [
      [{ px: "74049.0", sz: "7.79", n: 17 }],
      [{ px: "74050.0", sz: "0.4", n: 2 }],
    ];
    const frame = toMarketFrame({ channel: "l2Book", symbol: "BTC", nSigFigs: 5 }, "BTC", {
      type: "snapshot",
      levels: levelsPair,
      time: 1_794_384_366_062,
      degraded: ["slow"],
    });

    expect(frame?.data).toEqual({
      type: "snapshot",
      levels: levelsPair,
      time: 1_794_384_366_062,
      degraded: ["slow"],
    });
  });

  test("captured frame yields bids descending and asks ascending by numeric price", () => {
    const frame = readBookSnapshot(CAPTURED);
    expect(frame).not.toBeNull();
    const book = processRawL2Levels(
      frame?.levels[0] as L2BookLevel[],
      frame?.levels[1] as L2BookLevel[],
    );

    expect(prices(book.bids)).toEqual([74049, 74048, 74000]);
    expect(prices(book.asks)).toEqual([74050, 74051, 74100]);
    expect(book.bids[0]?.price).toBe(74049);
    expect(book.bids.at(-1)?.price).toBe(74000);
    expect(book.asks[0]?.price).toBe(74050);
    expect(book.asks.at(-1)?.price).toBe(74100);
  });

  test("the store commits the captured frame under the BTC:5 key", () => {
    const key = orderbookStoreKey("BTC", 5);
    const frame = readBookSnapshot(CAPTURED);
    expect(frame).not.toBeNull();
    useMarketDataStore
      .getState()
      .applyOrderbookSnapshot(key, [
        frame?.levels[0] as L2BookLevel[],
        frame?.levels[1] as L2BookLevel[],
      ]);
    flushFrame();

    const book: OrderbookData | undefined = useMarketDataStore.getState().orderbookData[key];
    expect(prices(book?.bids ?? [])).toEqual([74049, 74048, 74000]);
    expect(prices(book?.asks ?? [])).toEqual([74050, 74051, 74100]);
  });

  test("a price of 7409 sorts below 74049 by numeric price on both sides", () => {
    const book = processRawL2Levels(
      [
        { px: "7409.0", sz: "1", n: 1 },
        { px: "74049.0", sz: "1", n: 1 },
      ],
      [
        { px: "74049.0", sz: "1", n: 1 },
        { px: "7409.0", sz: "1", n: 1 },
      ],
    );

    expect(prices(book.bids)).toEqual([74049, 7409]);
    expect(prices(book.asks)).toEqual([7409, 74049]);
  });

  test("writer and reader keys agree for nSigFigs 5 and the default precision", () => {
    const coin = CAPTURED.data.coin;
    const subscriptionSigFigs = 5;
    const writerKey = orderbookStoreKey(coin, subscriptionSigFigs);
    const readerKey = orderbookStoreKey(coin, subscriptionSigFigs ?? null);

    expect(writerKey).toBe("BTC:5");
    expect(readerKey).toBe(writerKey);
    expect(orderbookStoreKey(coin, DEFAULT_SIG_FIGS)).toBe(writerKey);
  });

  test("the rendered gate opens for the captured book and the skeleton is not used", () => {
    const [bids, asks] = capturedLevels();
    const book = processRawL2Levels(bids, asks);

    expect(hasRenderableBook(undefined)).toBe(false);
    expect(hasRenderableBook({ bids: [], asks: [] })).toBe(false);
    expect(hasRenderableBook({ bids: book.bids, asks: [] })).toBe(true);
    expect(hasRenderableBook({ bids: [], asks: book.asks })).toBe(true);
    expect(hasRenderableBook({ bids: book.bids, asks: book.asks })).toBe(true);
  });

  test("a later frame with different prices but the same length commits", () => {
    const key = orderbookStoreKey("BTC", 5);
    const [bids, asks] = capturedLevels();
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [bids, asks]);
    flushFrame();

    const nextBids = bids.map((level) => ({ ...level, px: String(Number(level.px) + 100) }));
    const nextAsks = asks.map((level) => ({ ...level, px: String(Number(level.px) + 100) }));
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [nextBids, nextAsks]);
    flushFrame();

    const book: OrderbookData | undefined = useMarketDataStore.getState().orderbookData[key];
    expect(prices(book?.bids ?? [])).toEqual([74149, 74148, 74100]);
    expect(prices(book?.asks ?? [])).toEqual([74150, 74151, 74200]);
  });

  test("direct stream delivers the captured envelope to the store", async () => {
    const listeners: Array<(event: unknown) => void> = [];
    const noopHandle = (): { unsubscribe: () => Promise<void> } => ({
      unsubscribe: () => Promise.resolve(),
    });
    const sink: DirectMarketSink = {
      allMids: () => Promise.resolve(noopHandle()),
      l2Book: (_params, listener) => {
        listeners.push(listener);
        return Promise.resolve(noopHandle());
      },
      candle: () => Promise.resolve(noopHandle()),
      trades: () => Promise.resolve(noopHandle()),
    };
    const key = orderbookStoreKey("BTC", 5);
    const direct = createDirectMarketStream(sink);

    await direct.subscribe({ channel: "l2Book", symbol: "BTC", nSigFigs: 5 }, "BTC", {
      onMessage: (data) => {
        if (typeof data !== "object" || data === null) return;
        const levels = (data as { levels?: [L2BookLevel[], L2BookLevel[]] }).levels;
        if (levels === undefined) return;
        useMarketDataStore.getState().applyOrderbookSnapshot(key, [levels[0], levels[1]]);
      },
    });

    const listener = listeners[0];
    expect(listener).toBeDefined();
    listener?.(CAPTURED.data);
    flushFrame();

    const book: OrderbookData | undefined = useMarketDataStore.getState().orderbookData[key];
    expect(prices(book?.bids ?? [])).toEqual([74049, 74048, 74000]);
    expect(prices(book?.asks ?? [])).toEqual([74050, 74051, 74100]);
  });

  test("an older-time snapshot does not overwrite a newer book", () => {
    const key = orderbookStoreKey("BTC:TIME", 5);
    const [bids, asks] = capturedLevels();
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [bids, asks], { time: 2_000 });
    flushFrame();

    const newerBids = bids.map((level) => ({ ...level, sz: "9" }));
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [newerBids, asks], { time: 1_000 });
    flushFrame();

    const book: OrderbookData | undefined = useMarketDataStore.getState().orderbookData[key];
    expect(book?.bids[0]?.size).toBe(7.79);
    expect(useMarketDataStore.getState().orderbookMeta[key]?.time).toBe(2_000);
  });

  test("equal levels with a newer time do not commit", () => {
    const key = orderbookStoreKey("BTC:IDENTICAL", 5);
    const [bids, asks] = capturedLevels();
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [bids, asks], { time: 2_000 });
    flushFrame();

    const committed = useMarketDataStore.getState().orderbookData[key];
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [bids, asks], { time: 3_000 });
    flushFrame();

    expect(useMarketDataStore.getState().orderbookData[key]).toBe(committed);
    expect(useMarketDataStore.getState().orderbookMeta[key]?.time).toBe(2_000);
  });

  test("a level change with a newer time commits and records metadata", () => {
    const key = orderbookStoreKey("BTC:CHANGED", 5);
    const [bids, asks] = capturedLevels();
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [bids, asks], {
      time: 2_000,
      degraded: ["slow"],
    });
    flushFrame();

    const committed = useMarketDataStore.getState().orderbookData[key];
    const changedBids = bids.map((level) => ({ ...level, sz: "5" }));
    useMarketDataStore.getState().applyOrderbookSnapshot(key, [changedBids, asks], {
      time: 3_000,
      degraded: [],
    });
    flushFrame();

    expect(useMarketDataStore.getState().orderbookData[key]).not.toBe(committed);
    expect(useMarketDataStore.getState().orderbookMeta[key]?.time).toBe(3_000);
    expect(useMarketDataStore.getState().orderbookMeta[key]?.degraded).toEqual([]);
  });
});
