/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import type { WsMarketSubscription } from "@0xsignal/shared";
import type { MarketStreamClient } from "./market-stream-client";
import {
  createBrowserMarketStreamClient,
  createDirectMarketStream,
  toMarketFrame,
  useMarketStreamStatus,
  type DirectMarketSink,
  type MarketStreamCallbacks,
} from "./hl-market-stream";
import { bookFrameLeg } from "./l2-book-merge";
import { orderbookStoreKey, replaceBookLevels } from "./orderbook-book";
import type { L2BookLevel } from "../../../core/utils/hyperliquid";
import { useMarketDataStore } from "../../../stores/use-market-data-store";

beforeEach(() => {
  useMarketStreamStatus.setState({ source: "direct", state: "idle", reason: null });
});

interface SinkCalls {
  allMids: number;
  l2Book: Array<{ coin: string; nSigFigs?: 2 | 3 | 4 | 5; fast?: boolean }>;
  candle: number;
  unsubscribed: string[];
  /** One frame object reaches every l2Book listener, exactly like the transport. */
  emitBook: ((event: unknown) => void) | null;
  failL2Book: ((error: Error) => void) | null;
}

const makeSink = (
  options: { failL2Book?: boolean } = {},
): { sink: DirectMarketSink; calls: SinkCalls } => {
  const bookListeners: Array<(event: unknown) => void> = [];
  const calls: SinkCalls = {
    allMids: 0,
    l2Book: [],
    candle: 0,
    unsubscribed: [],
    emitBook: (event) => {
      for (const listener of bookListeners) listener(event);
    },
    failL2Book: null,
  };
  const sink: DirectMarketSink = {
    allMids: () => {
      calls.allMids++;
      return Promise.resolve({
        unsubscribe: () => {
          calls.unsubscribed.push("allMids");
          return Promise.resolve();
        },
      });
    },
    l2Book: (params, listener, onError) => {
      calls.l2Book.push(params);
      const leg = params.fast === true ? "fast" : "slow";
      bookListeners.push(listener);
      calls.failL2Book = onError;
      if (options.failL2Book === true) {
        return Promise.reject(new Error("direct blocked"));
      }
      return Promise.resolve({
        unsubscribe: () => {
          calls.unsubscribed.push(`l2Book:${params.coin}:${leg}`);
          return Promise.resolve();
        },
      });
    },
    candle: (params) => {
      calls.candle++;
      return Promise.resolve({
        unsubscribe: () => {
          calls.unsubscribed.push(`candle:${params.coin}`);
          return Promise.resolve();
        },
      });
    },
  };
  return { sink, calls };
};

interface BackendCalls {
  subscriptions: WsMarketSubscription[];
  callbacks: MarketStreamCallbacks[];
}

const makeBackend = (): { client: MarketStreamClient; calls: BackendCalls } => {
  const calls: BackendCalls = { subscriptions: [], callbacks: [] };
  const client: MarketStreamClient = {
    subscribe: (subscription, callbacks) => {
      calls.subscriptions.push(subscription);
      calls.callbacks.push(callbacks);
      return Promise.resolve({ unsubscribe: () => {} });
    },
  };
  return { client, calls };
};

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const quietCallbacks = (): MarketStreamCallbacks => ({ onMessage: () => {} });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toLevels = (value: unknown): L2BookLevel[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is L2BookLevel =>
      isRecord(entry) &&
      typeof entry["px"] === "string" &&
      typeof entry["sz"] === "string" &&
      typeof entry["n"] === "number",
  );
};

const levelSize = (book: unknown, side: "bids" | "asks", index: number): unknown => {
  if (!isRecord(book)) return undefined;
  const levels = book[side];
  if (!Array.isArray(levels)) return undefined;
  const level: unknown = levels[index];
  return isRecord(level) ? level["size"] : undefined;
};

const levels = (start: number, count: number, size: number) =>
  Array.from({ length: count }, (_, index) => ({
    px: String(start - index),
    sz: String(size),
    n: 1,
  }));

const askLevels = (start: number, count: number, size: number) =>
  Array.from({ length: count }, (_, index) => ({
    px: String(start + index),
    sz: String(size),
    n: 1,
  }));

const subscribeBook = async (direct: ReturnType<typeof createDirectMarketStream>) => {
  const messages: unknown[] = [];
  const handle = await direct.subscribe({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 }, "ETH", {
    onMessage: (data) => {
      messages.push(data);
    },
  });
  return { handle, messages };
};

const applyMergedToStore = (key: string, data: unknown): void => {
  if (!isRecord(data) || !Array.isArray(data["levels"])) return;
  const both = data["levels"];
  useMarketDataStore.getState().applyOrderbookSnapshot(key, [toLevels(both[0]), toLevels(both[1])]);
};

const subscribeStore = async (
  direct: ReturnType<typeof createDirectMarketStream>,
  key: string,
  symbol: string,
): Promise<void> => {
  await direct.subscribe({ channel: "l2Book", symbol, nSigFigs: 5 }, symbol, {
    onMessage: (data) => {
      applyMergedToStore(key, data);
    },
  });
};

describe("orderbook replace semantics", () => {
  test("a new l2Book snapshot drops levels absent from the frame", () => {
    const bids = new Map<string, { px: string; sz: string; n: number }>();
    const asks = new Map<string, { px: string; sz: string; n: number }>();

    replaceBookLevels(bids, [{ px: "100", sz: "1", n: 1 }]);
    replaceBookLevels(asks, [{ px: "101", sz: "1", n: 1 }]);
    replaceBookLevels(bids, [{ px: "99", sz: "2", n: 1 }]);
    replaceBookLevels(asks, [{ px: "102", sz: "2", n: 1 }]);

    expect([...bids.keys()]).toEqual(["99"]);
    expect([...asks.keys()]).toEqual(["102"]);
    expect(bids.has("100")).toBe(false);
  });

  test("precision is part of the key, so two feeds cannot collide", () => {
    const depthFive = orderbookStoreKey("ETH", 5);
    const depthThree = orderbookStoreKey("ETH", 3);

    expect(depthFive).not.toBe(depthThree);
    expect(depthFive).toBe("ETH:5");
    expect(orderbookStoreKey("ETH", null)).toBe("ETH:raw");
  });

  test("direct l2Book frames are snapshots, not deltas", () => {
    const frame = toMarketFrame({ channel: "l2Book", symbol: "@7", nSigFigs: 5 }, "PURR/USDC", {
      coin: "@7",
      levels: [[{ px: "1", sz: "2", n: 1 }], []],
    });

    expect(frame).toEqual({
      data: { type: "snapshot", levels: [[{ px: "1", sz: "2", n: 1 }], []] },
      meta: { coin: "PURR/USDC", nSigFigs: 5 },
    });
  });
});

describe("direct market stream refcount", () => {
  test("one key opens both l2Book legs and closes both on last release", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const subscription: WsMarketSubscription = { channel: "l2Book", symbol: "ETH", nSigFigs: 5 };

    const first = await direct.subscribe(subscription, "ETH", quietCallbacks());
    const second = await direct.subscribe(subscription, "ETH", quietCallbacks());

    expect(calls.l2Book).toEqual([
      { coin: "ETH", nSigFigs: 5 },
      { coin: "ETH", nSigFigs: 5, fast: true },
    ]);
    expect(direct.size()).toBe(1);

    first.unsubscribe();
    expect(calls.unsubscribed).toEqual([]);

    second.unsubscribe();
    expect(calls.unsubscribed).toEqual(["l2Book:ETH:slow", "l2Book:ETH:fast"]);
    expect(direct.size()).toBe(0);
  });
});

const bookSide = (book: unknown, side: "bids" | "asks"): unknown[] => {
  if (!isRecord(book)) return [];
  const sideLevels = book[side];
  return Array.isArray(sideLevels) ? sideLevels : [];
};

const snapshotSides = (message: unknown): [unknown, unknown] => {
  if (!isRecord(message) || !Array.isArray(message["levels"]))
    throw new Error("expected a snapshot");
  const both = message["levels"];
  return [both[0], both[1]];
};

const withRaf = async (run: (flush: () => void) => Promise<void>): Promise<void> => {
  const originalRaf = globalThis.requestAnimationFrame;
  let pending: FrameRequestCallback | null = null;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    pending = callback;
    return 1;
  };
  try {
    await run(() => {
      const callback = pending;
      pending = null;
      callback?.(0);
    });
  } finally {
    globalThis.requestAnimationFrame = originalRaf;
  }
};

describe("bookFrameLeg", () => {
  test("only an explicit fast:true frame belongs to the fast leg", () => {
    expect(bookFrameLeg({ fast: true })).toBe("fast");
    expect(bookFrameLeg({ fast: false })).toBe("slow");
    expect(bookFrameLeg({})).toBe("slow");
    expect(bookFrameLeg(null)).toBe("slow");
    expect(bookFrameLeg([])).toBe("slow");
  });
});

describe("two-leg l2Book merge", () => {
  test("a slow frame alone yields the full 20-level book", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const { messages } = await subscribeBook(direct);

    const bids = levels(100, 20, 10);
    const asks = askLevels(101, 20, 10);
    calls.emitBook?.({ levels: [bids, asks], time: 1 });

    expect(messages).toEqual([{ type: "snapshot", levels: [bids, asks] }]);
  });

  test("a fast frame replaces only the top 5 and keeps slow depth 6..20", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const { messages } = await subscribeBook(direct);

    const slowBids = levels(100, 20, 10);
    const slowAsks = askLevels(101, 20, 10);
    calls.emitBook?.({ levels: [slowBids, slowAsks], time: 1 });

    const fastBids = levels(100, 5, 1);
    const fastAsks = askLevels(101, 5, 1);
    calls.emitBook?.({ fast: true, levels: [fastBids, fastAsks], time: 2 });

    expect(messages).toHaveLength(2);
    const latest = messages.at(-1);
    expect(latest).toEqual({
      type: "snapshot",
      levels: [
        [...fastBids, ...slowBids.slice(5)],
        [...fastAsks, ...slowAsks.slice(5)],
      ],
    });
    expect(snapshotSides(latest)[0]).toHaveLength(20);
  });

  test("a fast frame never shrinks the book to its own 5 levels", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const { messages } = await subscribeBook(direct);

    calls.emitBook?.({ levels: [levels(100, 20, 10), askLevels(101, 20, 10)], time: 1 });
    calls.emitBook?.({ fast: true, levels: [levels(100, 5, 1), askLevels(101, 5, 1)], time: 2 });

    const [bids, asks] = snapshotSides(messages.at(-1));
    expect(bids).toHaveLength(20);
    expect(asks).toHaveLength(20);
  });

  test("a later slow frame does not regress the top 5 a newer fast frame set", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const { messages } = await subscribeBook(direct);

    calls.emitBook?.({ levels: [levels(100, 20, 10), askLevels(101, 20, 10)], time: 1 });
    const fastBids = levels(100, 5, 1);
    const fastAsks = askLevels(101, 5, 1);
    calls.emitBook?.({ fast: true, levels: [fastBids, fastAsks], time: 2 });

    // A newer slow frame moves both the top 5 and a deep level; only the deep
    // level may survive.
    const staleTopBids = levels(100, 20, 99);
    const staleTopAsks = askLevels(101, 20, 99);
    calls.emitBook?.({ levels: [staleTopBids, staleTopAsks], time: 3 });

    const latest = messages.at(-1);
    expect(latest).toEqual({
      type: "snapshot",
      levels: [
        [...fastBids, ...staleTopBids.slice(5)],
        [...fastAsks, ...staleTopAsks.slice(5)],
      ],
    });
  });

  test("disjoint fast and slow price ranges still cap at the 20-level ceiling", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const { messages } = await subscribeBook(direct);

    // 20 slow levels below the fast window: 25 distinct prices, sorted, capped.
    calls.emitBook?.({ levels: [levels(100, 20, 10), askLevels(101, 20, 10)], time: 1 });
    calls.emitBook?.({ fast: true, levels: [levels(105, 5, 1), askLevels(106, 5, 1)], time: 2 });

    const bids = toLevels(snapshotSides(messages.at(-1))[0]);
    expect(bids).toHaveLength(20);
    expect(bids[0]?.px).toBe("105");
    expect(bids[19]?.px).toBe("86");
  });

  test("a merged frame that only moves a deep level still reaches the store", async () => {
    await withRaf(async (flushFrame) => {
      const { sink, calls } = makeSink();
      const direct = createDirectMarketStream(sink);
      const key = orderbookStoreKey("MERGED-DEEP", 5);
      await subscribeStore(direct, key, "MERGED-DEEP");

      const bids = levels(100, 20, 10);
      const asks = askLevels(101, 20, 10);
      calls.emitBook?.({ levels: [bids, asks], time: 1 });
      flushFrame();

      calls.emitBook?.({ fast: true, levels: [levels(100, 5, 1), askLevels(101, 5, 1)], time: 2 });
      flushFrame();

      // Only the 10th bid moves; the top 5 stay from the fast leg.
      const deepBids = levels(100, 20, 10);
      deepBids[9] = { px: "91", sz: "42", n: 1 };
      calls.emitBook?.({ levels: [deepBids, asks], time: 3 });
      flushFrame();

      const book: unknown = useMarketDataStore.getState().orderbookData[key];
      expect(levelSize(book, "bids", 0)).toBe(1);
      expect(levelSize(book, "bids", 9)).toBe(42);
    });
  });

  test("slow 20 then fast 5 keeps 20 levels with the fast top 5 (regression)", async () => {
    await withRaf(async (flushFrame) => {
      const { sink, calls } = makeSink();
      const direct = createDirectMarketStream(sink);
      const key = orderbookStoreKey("SLOW-THEN-FAST", 5);
      await subscribeStore(direct, key, "SLOW-THEN-FAST");

      calls.emitBook?.({ levels: [levels(100, 20, 10), askLevels(101, 20, 10)], time: 1 });
      flushFrame();
      calls.emitBook?.({ fast: true, levels: [levels(100, 5, 1), askLevels(101, 5, 1)], time: 2 });
      flushFrame();

      const book: unknown = useMarketDataStore.getState().orderbookData[key];
      expect(bookSide(book, "bids")).toHaveLength(20);
      expect(bookSide(book, "asks")).toHaveLength(20);
      for (let index = 0; index < 5; index += 1) {
        expect(levelSize(book, "bids", index)).toBe(1);
        expect(levelSize(book, "asks", index)).toBe(1);
      }
      expect(levelSize(book, "bids", 5)).toBe(10);
      expect(levelSize(book, "bids", 19)).toBe(10);
      expect(levelSize(book, "asks", 19)).toBe(10);
    });
  });

  test("fast 5 then slow 20 keeps 20 levels and still lets fast win the top 5", async () => {
    await withRaf(async (flushFrame) => {
      const { sink, calls } = makeSink();
      const direct = createDirectMarketStream(sink);
      const key = orderbookStoreKey("FAST-THEN-SLOW", 5);
      await subscribeStore(direct, key, "FAST-THEN-SLOW");

      calls.emitBook?.({ fast: true, levels: [levels(100, 5, 1), askLevels(101, 5, 1)], time: 1 });
      flushFrame();
      calls.emitBook?.({ levels: [levels(100, 20, 10), askLevels(101, 20, 10)], time: 2 });
      flushFrame();

      const book: unknown = useMarketDataStore.getState().orderbookData[key];
      expect(bookSide(book, "bids")).toHaveLength(20);
      expect(bookSide(book, "asks")).toHaveLength(20);
      expect(levelSize(book, "bids", 0)).toBe(1);
      expect(levelSize(book, "bids", 4)).toBe(1);
      expect(levelSize(book, "bids", 5)).toBe(10);
      expect(levelSize(book, "bids", 19)).toBe(10);
    });
  });
});

describe("hybrid fallback", () => {
  test("an unresolvable symbol goes to the backend instead of guessing a coin", async () => {
    const { sink, calls } = makeSink();
    const backend = makeBackend();
    const client = createBrowserMarketStreamClient({
      sink,
      backend: backend.client,
      resolveCoin: () => Promise.resolve(null),
    });
    const subscription: WsMarketSubscription = {
      channel: "l2Book",
      symbol: "MISSING",
      nSigFigs: 5,
    };

    await client.subscribe(subscription, quietCallbacks());

    expect(calls.l2Book).toHaveLength(0);
    expect(backend.calls.subscriptions).toEqual([subscription]);
    expect(useMarketStreamStatus.getState().source).toBe("backend");
    expect(useMarketStreamStatus.getState().reason).toBe("unresolved:MISSING");
  });

  test("a failed direct connection flips to the backend for this and later subscriptions", async () => {
    const { sink, calls } = makeSink({ failL2Book: true });
    const backend = makeBackend();
    const client = createBrowserMarketStreamClient({
      sink,
      backend: backend.client,
      resolveCoin: () => Promise.resolve("@7"),
    });
    const subscription: WsMarketSubscription = {
      channel: "l2Book",
      symbol: "PURR/USDC",
      nSigFigs: 5,
    };

    await client.subscribe(subscription, quietCallbacks());

    expect(calls.l2Book).toEqual([
      { coin: "@7", nSigFigs: 5 },
      { coin: "@7", nSigFigs: 5, fast: true },
    ]);
    expect(backend.calls.subscriptions).toEqual([subscription]);
    expect(useMarketStreamStatus.getState().source).toBe("backend");
    expect(useMarketStreamStatus.getState().state).toBe("fallback");

    await client.subscribe({ channel: "allMids" }, quietCallbacks());

    expect(calls.allMids).toBe(0);
    expect(backend.calls.subscriptions).toEqual([subscription, { channel: "allMids" }]);
  });

  test("a live direct subscription is re-homed to the hub and keeps delivering", async () => {
    const { sink, calls } = makeSink();
    const backend = makeBackend();
    const client = createBrowserMarketStreamClient({
      sink,
      backend: backend.client,
      resolveCoin: () => Promise.resolve("@7"),
    });
    const subscription: WsMarketSubscription = {
      channel: "l2Book",
      symbol: "PURR/USDC",
      nSigFigs: 5,
    };
    const messages: unknown[] = [];

    const handle = await client.subscribe(subscription, {
      onMessage: (data) => {
        messages.push(data);
      },
    });

    calls.failL2Book?.(new Error("direct socket dropped"));
    await flush();

    expect(backend.calls.subscriptions).toEqual([{ channel: "l2Book", symbol: "@7", nSigFigs: 5 }]);
    expect(useMarketStreamStatus.getState().source).toBe("backend");

    backend.calls.callbacks[0]?.onMessage({ type: "snapshot", levels: [[], []] }, "l2Book", {
      coin: "PURR/USDC",
      nSigFigs: 5,
    });
    expect(messages).toEqual([{ type: "snapshot", levels: [[], []] }]);

    handle.unsubscribe();
  });
});
