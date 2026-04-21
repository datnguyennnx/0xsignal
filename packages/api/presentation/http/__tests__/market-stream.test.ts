import { describe, expect, it } from "vitest";
import { HyperliquidMarketStreamHub } from "../../../infrastructure/streams/hyperliquid/hub";
import { buildMarketWsBucketKey } from "../../../infrastructure/streams/hyperliquid/bucket-key";
import { parseMarketWsSubscription } from "../ws/subscription-parser";
import type { MarketWsSubscription } from "../../../schemas/market-data/ws";

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

  it("rejects unsupported long intervals not backed by HTTP/QuestDB", () => {
    const threeDay = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "3d" })
    );
    const oneMonth = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "BTC", interval: "1M" })
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
      "candle:BTC:1m"
    );
    expect(buildMarketWsBucketKey({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 })).toBe(
      "l2Book:ETH:5"
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
      new URLSearchParams({ channel: "candle", symbol: "XYZ:clusdt", interval: "1m" })
    );
    const parsedB = parseMarketWsSubscription(
      new URLSearchParams({ channel: "candle", symbol: "xyz:CL", interval: "1m" })
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

  type TestHub = {
    broadcast: (bucket: unknown, payload: unknown) => void;
    subscriptionClient: {
      candle?: (params: unknown, onEvent: (event: unknown) => void) => Promise<StubUpstream>;
      l2Book?: (params: unknown, onEvent: (event: unknown) => void) => Promise<StubUpstream>;
      trades?: (params: unknown, onEvent: (event: unknown) => void) => Promise<StubUpstream>;
      allMids?: (first: unknown, second?: (event: unknown) => void) => Promise<StubUpstream>;
    };
    subscribeUpstream: (bucket: unknown) => Promise<StubUpstream>;
  };

  const stubUpstream = {
    unsubscribe: async () => {},
    failureSignal: new AbortController().signal,
  };

  const createBucket = (subscription: MarketWsSubscription) => ({
    key: buildMarketWsBucketKey(subscription),
    subscription,
    clients: new Set(),
    restarting: false,
  });

  it("emits stable market envelope for candle", async () => {
    const hub = new HyperliquidMarketStreamHub() as unknown as TestHub;
    let broadcastPayload: unknown;

    hub.broadcast = (_bucket: unknown, payload: unknown) => {
      broadcastPayload = payload;
    };

    hub.subscriptionClient = {
      candle: async (_params: unknown, onEvent: (event: unknown) => void) => {
        onEvent({ data: { payload: [{ t: 1, o: "1", h: "2", l: "0", c: "1", v: "3" }] } });
        return stubUpstream;
      },
    };

    await hub.subscribeUpstream(createBucket({ channel: "candle", symbol: "BTC", interval: "1m" }));

    expect(broadcastPayload).toEqual({
      type: "market",
      channel: "candle",
      interval: "1m",
      data: [{ t: 1, o: "1", h: "2", l: "0", c: "1", v: "3" }],
    });
  });

  it("emits stable market envelope for l2Book", async () => {
    const hub = new HyperliquidMarketStreamHub() as unknown as TestHub;
    let broadcastPayload: unknown;

    hub.broadcast = (_bucket: unknown, payload: unknown) => {
      broadcastPayload = payload;
    };

    hub.subscriptionClient = {
      l2Book: async (_params: unknown, onEvent: (event: unknown) => void) => {
        onEvent({ data: { orderbook: { levels: [[{ px: "100", sz: "1" }], []] } } });
        return stubUpstream;
      },
    };

    await hub.subscribeUpstream(createBucket({ channel: "l2Book", symbol: "ETH", nSigFigs: 4 }));

    expect(broadcastPayload).toEqual({
      type: "market",
      channel: "l2Book",
      nSigFigs: 4,
      data: {
        levels: [[{ px: "100", sz: "1" }], []],
      },
    });
  });

  it("emits stable market envelope for trades", async () => {
    const hub = new HyperliquidMarketStreamHub() as unknown as TestHub;
    let broadcastPayload: unknown;

    hub.broadcast = (_bucket: unknown, payload: unknown) => {
      broadcastPayload = payload;
    };

    hub.subscriptionClient = {
      trades: async (_params: unknown, onEvent: (event: unknown) => void) => {
        onEvent({ payload: [{ side: "B", px: "100", sz: "1" }] });
        return stubUpstream;
      },
    };

    await hub.subscribeUpstream(createBucket({ channel: "trades", symbol: "SOL" }));

    expect(broadcastPayload).toEqual({
      type: "market",
      channel: "trades",
      data: [{ side: "B", px: "100", sz: "1" }],
    });
  });

  it("emits stable market envelope for allMids", async () => {
    const hub = new HyperliquidMarketStreamHub() as unknown as TestHub;
    let broadcastPayload: unknown;

    hub.broadcast = (_bucket: unknown, payload: unknown) => {
      broadcastPayload = payload;
    };

    hub.subscriptionClient = {
      allMids: async (first: unknown, second?: (event: unknown) => void) => {
        const onEvent = typeof first === "function" ? first : second!;
        onEvent({ data: { allMids: { BTC: "100" } } });
        return stubUpstream;
      },
    };

    await hub.subscribeUpstream(createBucket({ channel: "allMids" }));

    expect(broadcastPayload).toEqual({
      type: "market",
      channel: "allMids",
      data: { allMids: { BTC: "100" } },
    });
  });
});
