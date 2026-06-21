import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { buildMarketWsBucketKey } from "../../../infrastructure/streams/hyperliquid/bucket-key";
import { parseMarketWsSubscription } from "../ws/subscription-parser";
import type { MarketWsSubscription } from "../../../infrastructure/streams/hyperliquid/hub-types";
import { subscribeUpstream } from "../../../infrastructure/streams/hyperliquid/hub-subscription";
import { broadcast } from "../../../infrastructure/streams/hyperliquid/hub-broadcast";

describe("Market WS subscription parser", () => {
  it("parses candle subscription with defaults", () => {
    const params = new URLSearchParams({ channel: "candle", symbol: "btc" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "candle",
        symbol: "BTC",
        interval: "1m",
      },
    });
  });

  it("parses builder-perp symbol with canonical dex casing", () => {
    const params = new URLSearchParams({ channel: "candle", symbol: "XYZ:clusdt" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "candle",
        symbol: "xyz:CL",
        interval: "1m",
      },
    });
  });

  it("parses l2Book subscription with nSigFigs aliases", () => {
    const params = new URLSearchParams({
      channel: "l2Book",
      symbol: "ETH",
      depth: "4",
    });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "l2Book",
        symbol: "ETH",
        nSigFigs: 4,
      },
    });
  });

  it("prefers explicit nSigFigs over depth alias for l2Book; depth becomes maxDepth", () => {
    const params = new URLSearchParams({
      channel: "l2Book",
      symbol: "ETH",
      nSigFigs: "3",
      depth: "5",
    });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "l2Book",
        symbol: "ETH",
        nSigFigs: 3,
        depth: 5,
      },
    });
  });

  it("rejects malformed l2Book precision values", () => {
    const params = new URLSearchParams({
      channel: "l2Book",
      symbol: "ETH",
      nSigFigs: "2abc",
    });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      message: "Invalid nSigFigs/depth. Supported values are 2, 3, 4, 5.",
    });
  });

  it("supports allMids without symbol", () => {
    const params = new URLSearchParams({ channel: "allMids" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: true,
      data: {
        channel: "allMids",
        dex: undefined,
      },
    });
  });

  it("rejects invalid channel", () => {
    const params = new URLSearchParams({ channel: "ticker", symbol: "BTC" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported channel: ticker",
    });
  });

  it("rejects invalid interval", () => {
    const params = new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "10m" });
    const parsed = parseMarketWsSubscription(params);

    expect(parsed).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported interval: 10m",
    });
  });

  it("rejects unsupported long intervals not backed by HTTP/", () => {
    const threeDay = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "3d" }),
    );
    const oneMonth = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "1M" }),
    );

    expect(threeDay).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported interval: 3d",
    });

    expect(oneMonth).toEqual({
      ok: false,
      status: 400,
      message: "Unsupported interval: 1M",
    });
  });

  it("builds stable bucket keys", () => {
    expect(buildMarketWsBucketKey({ channel: "candle", symbol: "BTC", interval: "1m" })).toBe(
      "candle:BTC:1m",
    );
    expect(buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 })).toBe(
      "l2Book:ETH:5",
    );
    expect(buildMarketWsBucketKey({ channel: "trades", symbol: "SOL" })).toBe("trades:SOL");
    expect(buildMarketWsBucketKey({ channel: "allMids" })).toBe("allMids:");
  });

  it("changes l2Book bucket key when precision changes", () => {
    const sig5 = buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 });
    const sig3 = buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 3 });

    expect(sig5).toBe("l2Book:ETH:5");
    expect(sig3).toBe("l2Book:ETH:3");
    expect(sig5).not.toBe(sig3);
  });

  it("builds stable builder-perp bucket keys across mixed casing", () => {
    const parsedA = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "XYZ:clusdt", interval: "1m" }),
    );
    const parsedB = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "xyz:CL", interval: "1m" }),
    );

    expect(parsedA.ok).toBe(true);
    expect(parsedB.ok).toBe(true);
    if (!parsedA.ok || !parsedB.ok) {
      throw new Error("Expected parsed subscriptions");
    }

    expect(buildMarketWsBucketKey(parsedA.data)).toBe(buildMarketWsBucketKey(parsedB.data));
  });
});

describe("Market WS emitter contract", () => {
  const stubUpstream = {
    unsubscribe: async () => {},
  };

  const createBucket = (subscription: MarketWsSubscription) =>
    ({
      key: buildMarketWsBucketKey(subscription),
      subscription,
      clients: new Set(),
      state: { _tag: "idle" },
      upstream: undefined as unknown,
      retryCount: 0,
      restarting: false,
    }) as any;

  const noopDetach = () => {};

  it("emits stable market envelope for candle", async () => {
    const subscriptionClient = {
      candle: async (_params: unknown, onEvent: (event: unknown) => void) => {
        onEvent({ data: { payload: [{ t: 1, o: "1", h: "2", l: "0", c: "1", v: "3" }] } });
        return stubUpstream;
      },
    } as unknown as import("@nktkas/hyperliquid").SubscriptionClient;

    const bucket = createBucket({ channel: "candle", symbol: "BTC", interval: "1m" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach),
    );

    expect(upstream).toBeDefined();
    expect(upstream.unsubscribe).toBeDefined();
  });

  it("emits stable market envelope for l2Book", async () => {
    let callCount = 0;
    const subscriptionClient = {
      l2Book: async (_params: unknown, onEvent: (event: unknown) => void) => {
        callCount++;
        // Hybrid model: l2Book is called twice (fast + slow).
        // First call (fast) and second call (slow) both fire the event.
        onEvent({ data: { orderbook: { levels: [[{ px: "100", sz: "1" }], []] } } });
        return stubUpstream;
      },
    } as unknown as import("@nktkas/hyperliquid").SubscriptionClient;

    const bucket = createBucket({ channel: "l2Book", symbol: "ETH", nSigFigs: 4 });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach),
    );

    expect(upstream).toBeDefined();
    expect(upstream.unsubscribe).toBeDefined();
    // Both fast and slow subscriptions are established
    expect(callCount).toBe(2);
  });

  it("emits stable market envelope for trades", async () => {
    const subscriptionClient = {
      trades: async (_params: unknown, onEvent: (event: unknown) => void) => {
        onEvent({ payload: [{ side: "B", px: "100", sz: "1" }] });
        return stubUpstream;
      },
    } as unknown as import("@nktkas/hyperliquid").SubscriptionClient;

    const bucket = createBucket({ channel: "trades", symbol: "SOL" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach),
    );

    expect(upstream).toBeDefined();
    expect(upstream.unsubscribe).toBeDefined();
  });

  it("emits stable market envelope for allMids", async () => {
    const subscriptionClient = {
      allMids: async (first: unknown, second?: unknown, _third?: unknown) => {
        // v0.33.0: allMids(listener, options?) or allMids(params, listener, options?)
        const onEvent = typeof first === "function" ? first : second;
        (onEvent as (event: unknown) => void)({ data: { allMids: { BTC: "100" } } });
        return stubUpstream;
      },
    } as unknown as import("@nktkas/hyperliquid").SubscriptionClient;

    const bucket = createBucket({ channel: "allMids" });

    const upstream = await Effect.runPromise(
      subscribeUpstream(bucket, subscriptionClient, undefined, noopDetach),
    );

    expect(upstream).toBeDefined();
    expect(upstream.unsubscribe).toBeDefined();
  });
});

describe("Market WS fire-and-forget broadcast", () => {
  it("sends every message to every client immediately, without backpressure checks", () => {
    const sentMessages: string[] = [];

    const mockWs = {
      data: {
        id: "conn-1",
        bucketKey: "candle:BTC:1m",
        subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      },
      send(data: string) {
        sentMessages.push(data);
      },
    };

    const bucket = {
      key: "candle:BTC:1m",
      subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      clients: new Set([mockWs]),
      restarting: false,
      firstMarketBroadcastLogged: false,
      retryCount: 0,
    };

    const detach = () => {};
    const payload = { type: "market", channel: "candle", data: [{ t: 1 }] };
    broadcast(bucket, payload, detach);

    // Message is sent, not coalesced
    expect(sentMessages).toEqual([JSON.stringify(payload)]);
  });

  it("drops silently for a client whose send throws, but does NOT disconnect aggressively", () => {
    const detachLog: string[] = [];

    const mockWs = {
      data: {
        id: "conn-faulty",
        bucketKey: "candle:BTC:1m",
        subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      },
      send() {
        throw new Error("buffer full");
      },
    };

    const bucket = {
      key: "candle:BTC:1m",
      subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      clients: new Set([mockWs]),
      restarting: false,
      firstMarketBroadcastLogged: false,
      retryCount: 0,
    };

    const detach = (ws: any) => {
      bucket.clients.delete(ws);
      detachLog.push(ws.data.id);
    };

    broadcast(bucket, { type: "market", channel: "candle", data: [] }, detach);

    // Faulty client is detached silently
    expect(detachLog).toEqual(["conn-faulty"]);
    expect(bucket.clients.has(mockWs as any)).toBe(false);
  });

  it("sends to a healthy client even when another client throws", () => {
    const sentMessages: string[] = [];

    const faultyWs = {
      data: {
        id: "faulty",
        bucketKey: "candle:BTC:1m",
        subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      },
      send() {
        throw new Error("buffer full");
      },
    };

    const healthyWs = {
      data: {
        id: "healthy",
        bucketKey: "candle:BTC:1m",
        subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      },
      send(data: string) {
        sentMessages.push(data);
      },
    };

    const bucket = {
      key: "candle:BTC:1m",
      subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
      clients: new Set([faultyWs, healthyWs]),
      restarting: false,
      firstMarketBroadcastLogged: false,
      retryCount: 0,
    };

    const detach = (ws: any) => {
      bucket.clients.delete(ws);
    };

    const payload = { type: "market", channel: "candle", data: [{ t: 1 }] };
    broadcast(bucket, payload, detach);

    // Healthy client still gets the message
    expect(sentMessages).toEqual([JSON.stringify(payload)]);
  });
});
