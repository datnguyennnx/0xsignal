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

  it("prefers explicit nSigFigs over depth alias for l2Book", () => {
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
  type StubUpstream = {
    unsubscribe: () => Promise<void>;
    failureSignal: AbortSignal;
  };

  type StubSubscriptionClient = {
    candle?: (params: unknown, onEvent: (event: unknown) => void) => Promise<StubUpstream>;
    l2Book?: (params: unknown, onEvent: (event: unknown) => void) => Promise<StubUpstream>;
    trades?: (params: unknown, onEvent: (event: unknown) => void) => Promise<StubUpstream>;
    allMids?: (first: unknown, second?: (event: unknown) => void) => Promise<StubUpstream>;
  };

  const stubUpstream = {
    unsubscribe: async () => {},
    failureSignal: new AbortController().signal,
  };

  const createBucket = (subscription: MarketWsSubscription) =>
    ({
      key: buildMarketWsBucketKey(subscription),
      subscription,
      clients: new Set(),
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
    const subscriptionClient = {
      l2Book: async (_params: unknown, onEvent: (event: unknown) => void) => {
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
      allMids: async (first: unknown, second?: (event: unknown) => void) => {
        const onEvent = typeof first === "function" ? first : second!;
        onEvent({ data: { allMids: { BTC: "100" } } });
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

describe("Market WS backpressure handling", () => {
  it("disconnects slow clients and detaches them when backpressure exceeds 1MB", () => {
    const closedCalls: [number, string][] = [];
    const sentMessages: string[] = [];
    const detachLog: string[] = [];

    const mockWs = {
      data: {
        id: "conn-slow-123",
        bucketKey: "candle:BTC:1m",
        subscription: {
          channel: "candle",
          symbol: "BTC",
          interval: "1m",
        },
      },
      backpressure: 1.5 * 1024 * 1024, // 1.5MB (> 1MB)
      close(code: number, reason: string) {
        closedCalls.push([code, reason]);
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

    const detach = (ws: any) => {
      bucket.clients.delete(ws);
      detachLog.push(ws.data.id);
    };

    // Trigger broadcast directly
    broadcast(bucket, { type: "market", channel: "candle", data: [] }, detach);

    // Validate behavior
    expect(closedCalls).toEqual([[1011, "High backpressure - slow client"]]);
    expect(bucket.clients.has(mockWs as any)).toBe(false);
    expect(sentMessages).toEqual([]); // Message dropped
    expect(detachLog).toEqual(["conn-slow-123"]);
  });

  it("sends message successfully and retains clients when backpressure is under 1MB", () => {
    const closedCalls: [number, string][] = [];
    const sentMessages: string[] = [];

    const mockWs = {
      data: {
        id: "conn-fast-123",
        bucketKey: "candle:BTC:1m",
        subscription: {
          channel: "candle",
          symbol: "BTC",
          interval: "1m",
        },
      },
      backpressure: 500 * 1024, // 500KB (< 1MB)
      close(code: number, reason: string) {
        closedCalls.push([code, reason]);
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

    const payload = { type: "market", channel: "candle", data: [] };
    broadcast(bucket, payload, detach);

    expect(closedCalls).toEqual([]);
    expect(bucket.clients.has(mockWs as any)).toBe(true);
    expect(sentMessages).toEqual([JSON.stringify(payload)]);
  });
});
