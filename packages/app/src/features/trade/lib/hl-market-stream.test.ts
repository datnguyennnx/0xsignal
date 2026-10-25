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
import { orderbookStoreKey, replaceBookLevels } from "./orderbook-book";

beforeEach(() => {
  useMarketStreamStatus.setState({ source: "direct", state: "idle", reason: null });
});

interface SinkCalls {
  allMids: number;
  l2Book: Array<{ coin: string; nSigFigs?: 2 | 3 | 4 | 5 }>;
  candle: number;
  unsubscribed: string[];
  emitL2Book: ((event: unknown) => void) | null;
}

const makeSink = (
  options: { failL2Book?: boolean } = {},
): { sink: DirectMarketSink; calls: SinkCalls } => {
  const calls: SinkCalls = {
    allMids: 0,
    l2Book: [],
    candle: 0,
    unsubscribed: [],
    emitL2Book: null,
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
    l2Book: (params, listener) => {
      calls.l2Book.push(params);
      calls.emitL2Book = listener;
      if (options.failL2Book === true) {
        return Promise.reject(new Error("direct blocked"));
      }
      return Promise.resolve({
        unsubscribe: () => {
          calls.unsubscribed.push(`l2Book:${params.coin}`);
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
}

const makeBackend = (): { client: MarketStreamClient; calls: BackendCalls } => {
  const calls: BackendCalls = { subscriptions: [] };
  const client: MarketStreamClient = {
    subscribe: (subscription) => {
      calls.subscriptions.push(subscription);
      return Promise.resolve({ unsubscribe: () => {} });
    },
  };
  return { client, calls };
};

const quietCallbacks = (): MarketStreamCallbacks => ({ onMessage: () => {} });

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
  test("one upstream subscription serves duplicate consumers and unsubscribes on last release", async () => {
    const { sink, calls } = makeSink();
    const direct = createDirectMarketStream(sink);
    const subscription: WsMarketSubscription = { channel: "l2Book", symbol: "ETH", nSigFigs: 5 };

    const first = await direct.subscribe(subscription, "ETH", quietCallbacks());
    const second = await direct.subscribe(subscription, "ETH", quietCallbacks());

    expect(calls.l2Book).toHaveLength(1);
    expect(direct.size()).toBe(1);

    first.unsubscribe();
    expect(calls.unsubscribed).toEqual([]);

    second.unsubscribe();
    expect(calls.unsubscribed).toEqual(["l2Book:ETH"]);
    expect(direct.size()).toBe(0);
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

    expect(calls.l2Book).toEqual([{ coin: "@7", nSigFigs: 5 }]);
    expect(backend.calls.subscriptions).toEqual([subscription]);
    expect(useMarketStreamStatus.getState().source).toBe("backend");
    expect(useMarketStreamStatus.getState().state).toBe("fallback");

    await client.subscribe({ channel: "allMids" }, quietCallbacks());

    expect(calls.allMids).toBe(0);
    expect(backend.calls.subscriptions).toEqual([subscription, { channel: "allMids" }]);
  });
});
