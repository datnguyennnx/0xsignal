/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

import type { WsMarketSubscription } from "@0xsignal/shared";

import { restoreDomGlobals } from "../../../../test/setup";

import {
  createMarketStreamClient,
  type MarketStreamClient,
  type MarketStreamMeta,
} from "./market-stream-client";

interface Frame {
  readonly type: "subscribe" | "unsubscribe";
  readonly subscription: WsMarketSubscription;
}

const isFrame = (value: unknown): value is Frame => {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value) || !("subscription" in value)) return false;
  return value.type === "subscribe" || value.type === "unsubscribe";
};

let sockets: FakeWebSocket[] = [];
let log: string[] = [];

/** Test double: the client only touches readyState, send, close and listeners. */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: Frame[] = [];
  closeCalled = false;

  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    sockets.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(): number {
    let total = 0;
    for (const listeners of this.listeners.values()) total += listeners.size;
    return total;
  }

  send(raw: string): void {
    const frame: unknown = JSON.parse(raw);
    if (!isFrame(frame)) throw new Error(`Unexpected subscription frame: ${raw}`);
    this.sent.push(frame);
    log.push(`send:${frame.type}:${frame.subscription.channel}`);
  }

  close(): void {
    this.closeCalled = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  disconnect(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  message(payload: unknown): void {
    this.emit("message", { data: JSON.stringify(payload) });
  }

  private emit(type: string, event?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const nativeWebSocket = globalThis.WebSocket;

beforeEach(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    value: FakeWebSocket,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    value: nativeWebSocket,
    configurable: true,
    writable: true,
  });
});

type Callbacks = Parameters<MarketStreamClient["subscribe"]>[1];
type Subscription = Awaited<ReturnType<MarketStreamClient["subscribe"]>>;

let subscriptions: Subscription[] = [];

const subscribe = async (
  client: MarketStreamClient,
  subscription: WsMarketSubscription,
  callbacks: Callbacks,
): Promise<Subscription> => {
  const active = await client.subscribe(subscription, callbacks);
  subscriptions.push(active);
  return active;
};

const makeCallbacks = (label: string) => {
  const received: { data: unknown; channel: string; meta?: MarketStreamMeta }[] = [];
  const callbacks: Callbacks = {
    onMessage: (data, channel, meta) => {
      received.push(meta === undefined ? { data, channel } : { data, channel, meta });
    },
    onConnectionChange: (connected) => {
      log.push(`${label}:connected:${connected}`);
    },
    onError: (error) => {
      log.push(`${label}:error:${error.message}`);
    },
  };
  return { received, callbacks };
};

beforeEach(() => {
  sockets = [];
  log = [];
});

afterEach(() => {
  for (const subscription of subscriptions) subscription.unsubscribe();
  subscriptions = [];
  jest.useRealTimers();
});

describe("market-stream-client subscription identity", () => {
  test("normalizes candle identity and subscribes once for duplicate acquires", async () => {
    const client = createMarketStreamClient();
    const first = makeCallbacks("first");
    const second = makeCallbacks("second");

    await subscribe(
      client,
      { channel: "candle", symbol: " btcusdt ", interval: "15m" },
      first.callbacks,
    );
    await subscribe(
      client,
      { channel: "candle", symbol: "btc", interval: "15m" },
      second.callbacks,
    );

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent).toEqual([]);

    sockets[0]?.open();

    expect(sockets[0]?.sent).toEqual([
      {
        type: "subscribe",
        subscription: { channel: "candle", symbol: "BTC", interval: "15m" },
      },
    ]);
  });

  test("keeps l2Book depth variants distinct and closes after the last release", async () => {
    const client = createMarketStreamClient();
    const five = makeCallbacks("five");
    const three = makeCallbacks("three");

    const depthFive = await subscribe(
      client,
      { channel: "l2Book", symbol: "ETH", nSigFigs: 5 },
      five.callbacks,
    );
    await subscribe(client, { channel: "l2Book", symbol: "ETH", nSigFigs: 3 }, three.callbacks);

    sockets[0]?.open();

    expect(sockets[0]?.sent.map((frame) => frame.subscription)).toEqual([
      { channel: "l2Book", symbol: "ETH", nSigFigs: 5 },
      { channel: "l2Book", symbol: "ETH", nSigFigs: 3 },
    ]);

    depthFive.unsubscribe();

    expect(sockets[0]?.sent.at(-1)).toEqual({
      type: "unsubscribe",
      subscription: { channel: "l2Book", symbol: "ETH", nSigFigs: 5 },
    });
    expect(sockets[0]?.closeCalled).toBe(false);
  });

  test("does not subscribe twice when a duplicate acquire lands after open", async () => {
    const client = createMarketStreamClient();
    const first = makeCallbacks("first");
    const second = makeCallbacks("second");

    const firstSubscription = await subscribe(
      client,
      { channel: "candle", symbol: "BTC", interval: "1m" },
      first.callbacks,
    );
    sockets[0]?.open();
    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, second.callbacks);

    expect(sockets[0]?.sent).toHaveLength(1);

    firstSubscription.unsubscribe();

    expect(sockets[0]?.sent).toHaveLength(1);
    expect(sockets[0]?.closeCalled).toBe(false);
  });
});

describe("market-stream-client routing", () => {
  test("routes candle frames by coin and interval and l2Book frames by depth", async () => {
    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");
    const eth = makeCallbacks("eth");
    const depthFive = makeCallbacks("depth-five");
    const depthThree = makeCallbacks("depth-three");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);
    await subscribe(client, { channel: "candle", symbol: "ETH", interval: "1m" }, eth.callbacks);
    await subscribe(client, { channel: "l2Book", symbol: "BTC", nSigFigs: 5 }, depthFive.callbacks);
    await subscribe(
      client,
      { channel: "l2Book", symbol: "BTC", nSigFigs: 3 },
      depthThree.callbacks,
    );

    sockets[0]?.open();

    sockets[0]?.message({
      channel: "candle",
      coin: "BTC",
      interval: "1m",
      data: {
        t: 1_700_000_000,
        T: 1_700_000_059,
        s: "BTC",
        i: "1m",
        o: "100",
        c: "105",
        h: "110",
        l: "90",
        v: "12.5",
        n: 1,
      },
    });

    expect(btc.received).toEqual([
      {
        channel: "candle",
        data: [{ time: 1_700_000_000, open: 100, high: 110, low: 90, close: 105, volume: 12.5 }],
        meta: { coin: "BTC", interval: "1m" },
      },
    ]);
    expect(eth.received).toEqual([]);
    expect(depthFive.received).toEqual([]);
    expect(depthThree.received).toEqual([]);

    sockets[0]?.message({ channel: "l2Book", data: { levels: [[], []], nSigFigs: 5 } });

    expect(depthFive.received).toHaveLength(1);
    expect(depthThree.received).toEqual([]);
  });

  test("routes a candle frame whose data is an array", async () => {
    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);
    sockets[0]?.open();

    sockets[0]?.message({
      channel: "candle",
      coin: "BTC",
      interval: "1m",
      data: [
        {
          t: 1_700_000_000,
          T: 1_700_000_059,
          s: "BTC",
          i: "1m",
          o: "100",
          c: "105",
          h: "110",
          l: "90",
          v: "12.5",
          n: 1,
        },
      ],
    });

    expect(btc.received).toEqual([
      {
        channel: "candle",
        data: [{ time: 1_700_000_000, open: 100, high: 110, low: 90, close: 105, volume: 12.5 }],
        meta: { coin: "BTC", interval: "1m" },
      },
    ]);
  });
});

// ── Page visibility coalescing ──────────────────────────────────────
// The fake document is shared across tests so the client's single
// module-lifetime listener keeps pointing at it.

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

// Installed at module load so the client's module-lifetime watcher binds here.
Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });

const candleMessage = (coin: string, close: number) => ({
  channel: "candle",
  coin,
  interval: "1m",
  data: {
    t: 1_700_000_000,
    T: 1_700_000_059,
    s: coin,
    i: "1m",
    o: "100",
    c: String(close),
    h: "110",
    l: "90",
    v: "1",
    n: 1,
  },
});

const lastClose = (received: { data: unknown }[]): unknown => {
  const data = received.at(-1)?.data;
  if (!Array.isArray(data)) return undefined;
  const candle: unknown = data.at(-1);
  return typeof candle === "object" && candle !== null && "close" in candle
    ? candle.close
    : undefined;
};

describe("market-stream-client page visibility", () => {
  beforeEach(() => {
    fakeDocument.visibilityState = "visible";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: fakeDocument,
    });
  });

  afterEach(() => {
    fakeDocument.visibilityState = "visible";
    restoreDomGlobals();
  });

  test("coalesces hidden frames and delivers the latest once on visible", async () => {
    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);
    sockets[0]?.open();

    setVisibility("hidden");
    for (let close = 1; close <= 5; close++) sockets[0]?.message(candleMessage("BTC", close));

    expect(btc.received).toHaveLength(0);
    expect(sockets[0]?.closeCalled).toBe(false);

    setVisibility("visible");

    expect(btc.received).toHaveLength(1);
    expect(lastClose(btc.received)).toBe(5);
  });

  test("keeps the latest frame per subscription", async () => {
    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");
    const eth = makeCallbacks("eth");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);
    await subscribe(client, { channel: "candle", symbol: "ETH", interval: "1m" }, eth.callbacks);
    sockets[0]?.open();

    setVisibility("hidden");
    sockets[0]?.message(candleMessage("BTC", 11));
    sockets[0]?.message(candleMessage("ETH", 21));
    sockets[0]?.message(candleMessage("BTC", 12));
    sockets[0]?.message(candleMessage("ETH", 22));

    expect(btc.received).toHaveLength(0);
    expect(eth.received).toHaveLength(0);

    setVisibility("visible");

    expect(btc.received).toHaveLength(1);
    expect(eth.received).toHaveLength(1);
    expect(lastClose(btc.received)).toBe(12);
    expect(lastClose(eth.received)).toBe(22);
  });

  test("does not deliver a retained frame after unsubscribing while hidden", async () => {
    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    const active = await subscribe(
      client,
      { channel: "candle", symbol: "BTC", interval: "1m" },
      btc.callbacks,
    );
    sockets[0]?.open();

    setVisibility("hidden");
    sockets[0]?.message(candleMessage("BTC", 42));
    active.unsubscribe();

    setVisibility("visible");

    expect(btc.received).toHaveLength(0);
  });
});

describe("market-stream-client reconnect", () => {
  test("re-subscribes every active subscription on reconnect", async () => {
    jest.useFakeTimers();

    const client = createMarketStreamClient();
    const candle = makeCallbacks("candle");
    const mids = makeCallbacks("allMids");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, candle.callbacks);
    await subscribe(client, { channel: "allMids" }, mids.callbacks);

    const first = sockets[0];
    first?.open();

    first?.disconnect();
    jest.advanceTimersByTime(1000);

    expect(sockets).toHaveLength(2);
    const second = sockets[1];
    expect(second?.sent).toEqual([]);

    second?.open();

    expect(second?.sent).toEqual([
      { type: "subscribe", subscription: { channel: "candle", symbol: "BTC", interval: "1m" } },
      { type: "subscribe", subscription: { channel: "allMids" } },
    ]);

    const reconnectStart = log.indexOf("candle:connected:false");
    expect(log.slice(reconnectStart)).toEqual([
      "candle:connected:false",
      "allMids:connected:false",
      "send:subscribe:candle",
      "send:subscribe:allMids",
      "candle:connected:true",
      "allMids:connected:true",
    ]);
  });
});

// ── Stale connection recovery (sleep / screen lock) ─────────────────
// A zombie socket keeps `readyState === OPEN` and never fires `close`, so the
// only reliable signal is how long ago the last inbound frame arrived.

describe("market-stream-client stale connection recovery", () => {
  beforeEach(() => {
    fakeDocument.visibilityState = "visible";
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: fakeDocument,
    });
  });

  afterEach(() => {
    fakeDocument.visibilityState = "visible";
    restoreDomGlobals();
  });

  test("reconnects a stale socket and detaches the old handlers", async () => {
    jest.useFakeTimers();

    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);

    const stale = sockets[0];
    stale?.open();
    expect(stale?.listenerCount()).toBe(4);

    jest.advanceTimersByTime(70_000);
    client.reconnectIfStale();

    expect(sockets).toHaveLength(2);
    expect(stale?.closeCalled).toBe(true);
    expect(stale?.listenerCount()).toBe(0);

    // A zombie frame must not reach the removed handlers.
    stale?.message(candleMessage("BTC", 99));
    expect(btc.received).toEqual([]);

    const replacement = sockets[1];
    replacement?.open();
    expect(replacement?.sent).toEqual([
      { type: "subscribe", subscription: { channel: "candle", symbol: "BTC", interval: "1m" } },
    ]);
  });

  test("leaves a socket with recent inbound traffic untouched", async () => {
    jest.useFakeTimers();

    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);

    const socket = sockets[0];
    socket?.open();
    socket?.message(candleMessage("BTC", 7));
    expect(btc.received).toHaveLength(1);

    jest.advanceTimersByTime(64_000);
    client.reconnectIfStale();

    expect(sockets).toHaveLength(1);
    expect(socket?.closeCalled).toBe(false);
    expect(socket?.listenerCount()).toBe(4);
  });

  test("never reconnects an entry that has no subscriptions", async () => {
    jest.useFakeTimers();

    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    const active = await subscribe(
      client,
      { channel: "candle", symbol: "BTC", interval: "1m" },
      btc.callbacks,
    );
    const socket = sockets[0];
    socket?.open();
    active.unsubscribe();

    jest.advanceTimersByTime(70_000);
    client.reconnectIfStale();

    expect(sockets).toHaveLength(1);
    expect(socket?.closeCalled).toBe(true);
  });

  test("checks liveness on page resume", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));

    const client = createMarketStreamClient();
    const btc = makeCallbacks("btc");

    await subscribe(client, { channel: "candle", symbol: "BTC", interval: "1m" }, btc.callbacks);

    const socket = sockets[0];
    socket?.open();
    socket?.message(candleMessage("BTC", 3));

    jest.setSystemTime(new Date("2030-01-01T00:01:30.000Z"));
    setVisibility("visible");

    expect(sockets).toHaveLength(2);
    expect(socket?.closeCalled).toBe(true);
    expect(socket?.listenerCount()).toBe(0);
  });

  test("reconnect keeps registrations and refcounts intact", async () => {
    jest.useFakeTimers();

    const client = createMarketStreamClient();
    const first = makeCallbacks("first");
    const second = makeCallbacks("second");

    const firstSubscription = await subscribe(
      client,
      { channel: "candle", symbol: "BTC", interval: "1m" },
      first.callbacks,
    );
    const secondSubscription = await subscribe(
      client,
      { channel: "candle", symbol: "BTC", interval: "1m" },
      second.callbacks,
    );

    const stale = sockets[0];
    stale?.open();
    // Two registrations share one subscription key, so only one frame is sent.
    expect(stale?.sent).toHaveLength(1);

    jest.advanceTimersByTime(70_000);
    client.reconnectIfStale();

    expect(sockets).toHaveLength(2);
    const replacement = sockets[1];
    replacement?.open();

    expect(replacement?.sent).toEqual([
      { type: "subscribe", subscription: { channel: "candle", symbol: "BTC", interval: "1m" } },
    ]);

    firstSubscription.unsubscribe();
    expect(replacement?.sent).toHaveLength(1);
    expect(replacement?.closeCalled).toBe(false);

    secondSubscription.unsubscribe();
    // The unsubscribe is only sent once the refcount reaches zero.
    expect(replacement?.sent).toHaveLength(2);
    expect(replacement?.sent.at(-1)).toEqual({
      type: "unsubscribe",
      subscription: { channel: "candle", symbol: "BTC", interval: "1m" },
    });
    expect(replacement?.closeCalled).toBe(true);
  });
});
