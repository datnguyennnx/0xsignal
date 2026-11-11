import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { cast } from "../core/parse";
import type { Subscription } from "./types";
import { WsClient } from "./client";

let sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  readonly #listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.#emit("close");
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.#emit("open");
  }

  message(payload: unknown): void {
    this.#emit("message", { data: JSON.stringify(payload) });
  }

  #emit(type: string, event?: { data?: unknown }): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event ?? {});
  }
}

const FakeSocketImpl = cast<typeof WebSocket>(FakeWebSocket, "webSocketImpl");

const noop = (): void => {};

const socketOf = (): FakeWebSocket => {
  const [socket] = sockets;
  if (socket === undefined) throw new Error("no websocket was created");
  return socket;
};

const settle = async (turns = 8): Promise<void> => {
  if (turns <= 0) return;
  await Promise.resolve();
  return settle(turns - 1);
};

const connect = (): WsClient => {
  const client = new WsClient({ webSocketImpl: FakeSocketImpl, shouldReconnect: false });
  socketOf().open();
  return client;
};

const bookFrame = (coin: string, depth: number, fast = false): Record<string, unknown> => ({
  channel: "l2Book",
  data: {
    coin,
    time: 1,
    levels: Array.from({ length: 2 }, () =>
      Array.from({ length: depth }, (_, index) => ({ px: String(index), sz: "1", n: 1 })),
    ),
    spread: "0.25",
    ...(fast && { fast: true }),
  },
});

const receipts = (): unknown[] => {
  const frames: unknown[] = [];
  for (const frame of socketOf().sent) {
    const parsed: unknown = JSON.parse(frame);
    frames.push(parsed);
  }
  return frames;
};

const methods = (): unknown[] =>
  receipts().map((frame) => cast<{ method?: unknown }>(frame, "frame").method);

const subscriptionsOf = (): unknown[] =>
  receipts()
    .filter((frame) => cast<{ method?: unknown }>(frame, "frame").method === "subscribe")
    .map((frame) => cast<{ subscription?: unknown }>(frame, "frame").subscription);

beforeEach(() => {
  sockets = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe("wildcard routing", () => {
  test("a wildcard subscription receives a dex-qualified frame", async () => {
    const client = connect();
    const received: unknown[] = [];
    const subscription: Subscription = { type: "allDexsClearinghouseState", user: "0xabc" };
    client.subscribe(subscription, (data) => {
      received.push(data);
    });

    socketOf().message({
      channel: "allDexsClearinghouseState",
      data: { dex: "xyz", clearinghouseStates: [] },
    });
    await settle();

    expect(received).toHaveLength(1);
    client.close();
  });

  test("a frame without a discriminator does not reach a user-scoped subscription", async () => {
    const client = connect();
    const received: unknown[] = [];
    const subscription: Subscription = {
      type: "clearinghouseState",
      user: "0xabc",
      dex: "main",
    };
    client.subscribe(subscription, (data) => {
      received.push(data);
    });

    socketOf().message({
      channel: "clearinghouseState",
      data: { clearinghouseState: { marginSummary: {} } },
    });
    await settle();

    expect(received).toHaveLength(0);
    client.close();
  });
});

describe("ack correlation", () => {
  test("an ack with reordered keys still resolves the pending subscription", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    const subscription: Subscription = { type: "l2Book", coin: "BTC" };
    client.subscribe(subscription, noop);

    socketOf().message({
      channel: "subscriptionResponse",
      data: { method: "subscribe", subscription: { coin: "BTC", type: "l2Book" } },
    });
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(errors).toHaveLength(0);
    const methods = receipts().map((frame) => cast<{ method?: unknown }>(frame, "frame").method);
    expect(methods).toEqual(["subscribe"]);
    client.close();
  });
});

describe("l2Book core routing", () => {
  test("a slow frame reaches a slow subscriber once", async () => {
    const client = connect();
    const received: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "BTC" }, (data) => {
      received.push(data);
    });

    socketOf().message(bookFrame("BTC", 20));
    await settle();

    expect(received).toHaveLength(1);
    client.close();
  });

  test("a deep frame is delivered regardless of level count", async () => {
    const client = connect();
    const received: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "BTC" }, (data) => {
      received.push(data);
    });

    socketOf().message(bookFrame("BTC", 20));
    await settle();

    expect(received).toHaveLength(1);
    client.close();
  });

  test("a candle frame routes by its echoed symbol and interval", async () => {
    const client = connect();
    const received: unknown[] = [];
    const subscription: Subscription = { type: "candle", coin: "BTC", interval: "15m" };
    client.subscribe(subscription, (data) => {
      received.push(data);
    });

    socketOf().message({
      channel: "candle",
      data: [{ s: "BTC", i: "15m", t: 1, T: 2, o: 1, c: 1, h: 1, l: 1, v: 1, n: 1 }],
    });
    socketOf().message({
      channel: "candle",
      data: [{ s: "BTC", i: "1h", t: 1, T: 2, o: 1, c: 1, h: 1, l: 1, v: 1, n: 1 }],
    });
    await settle();

    expect(received).toHaveLength(1);
    client.close();
  });

  test("a frame whose core discriminator matches nothing reports to onError", async () => {
    const client = connect();
    const errors: unknown[] = [];
    const received: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", fast: true }, (data) => {
      received.push(data);
    });

    socketOf().message(bookFrame("DOGE", 5));
    await settle();

    expect(received).toHaveLength(0);
    expect(errors).toHaveLength(1);
    client.close();
  });
});

describe("subscription send keys", () => {
  test("subscriptions differing in fast send two frames and both acks resolve", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    const fast: Subscription = { type: "l2Book", coin: "BTC", fast: true };
    const slow: Subscription = { type: "l2Book", coin: "BTC", fast: false };
    client.subscribe(fast, noop);
    client.subscribe(slow, noop);

    expect(methods()).toEqual(["subscribe", "subscribe"]);

    socketOf().message({
      channel: "subscriptionResponse",
      data: { method: "subscribe", subscription: slow },
    });
    socketOf().message({
      channel: "subscriptionResponse",
      data: { method: "subscribe", subscription: fast },
    });
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(errors).toHaveLength(0);
    client.close();
  });

  test("the same subscription twice sends one frame", () => {
    const client = connect();
    const subscription: Subscription = { type: "l2Book", coin: "BTC", nSigFigs: 5 };
    client.subscribe(subscription, noop);
    client.subscribe(subscription, noop);

    expect(methods()).toEqual(["subscribe"]);
    client.close();
  });

  test("a fast frame reaches only fast handles on the same client", async () => {
    const client = connect();
    const fast: unknown[] = [];
    const slow: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "BTC", fast: true }, (data) => {
      fast.push(data);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", fast: false }, (data) => {
      slow.push(data);
    });

    socketOf().message(bookFrame("BTC", 5, true));
    await settle();

    expect(fast).toHaveLength(1);
    expect(slow).toHaveLength(0);
    client.close();
  });

  test("unsubscribing one handle keeps the sibling and the route entry alive", async () => {
    const client = connect();
    const errors: unknown[] = [];
    const first: unknown[] = [];
    const second: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    const handle = client.subscribe({ type: "l2Book", coin: "BTC", fast: true }, (data) => {
      first.push(data);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", fast: false }, (data) => {
      second.push(data);
    });

    handle.unsubscribe();
    expect(methods()).toEqual(["subscribe", "subscribe", "unsubscribe"]);

    socketOf().message({
      channel: "l2Book",
      data: { coin: "BTC", levels: [[], []], time: 2 },
    });
    await settle();

    expect(first).toHaveLength(0);
    expect(second).toHaveLength(1);
    expect(errors).toHaveLength(0);
    client.close();
  });

  test("subscriptions differing in nSigFigs send two frames", () => {
    const client = connect();
    client.subscribe({ type: "l2Book", coin: "BTC", nSigFigs: 5 }, noop);
    client.subscribe({ type: "l2Book", coin: "BTC", nSigFigs: 2 }, noop);

    expect(methods()).toEqual(["subscribe", "subscribe"]);
    expect(subscriptionsOf()).toEqual([
      { type: "l2Book", coin: "BTC", nSigFigs: 5 },
      { type: "l2Book", coin: "BTC", nSigFigs: 2 },
    ]);
    client.close();
  });
});

describe("ack echo defaults", () => {
  test("an echo with mantissa and fast defaults resolves the pending ack", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    const received: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", nSigFigs: 5 }, (data) => {
      received.push(data);
    });

    socketOf().message({
      channel: "subscriptionResponse",
      data: {
        method: "subscribe",
        subscription: { type: "l2Book", coin: "BTC", nSigFigs: 5, mantissa: null, fast: false },
      },
    });
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(errors).toHaveLength(0);
    expect(methods()).toEqual(["subscribe"]);

    socketOf().message({ channel: "l2Book", data: { coin: "BTC", levels: [[], []], time: 1 } });
    await settle();
    expect(received).toHaveLength(1);
    client.close();
  });

  test("a fast subscription resolves an echo carrying fast true", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "l2Book", coin: "ETH", fast: true }, noop);

    socketOf().message({
      channel: "subscriptionResponse",
      data: {
        method: "subscribe",
        subscription: { type: "l2Book", coin: "ETH", nSigFigs: null, mantissa: null, fast: true },
      },
    });
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(errors).toHaveLength(0);
    expect(subscriptionsOf()).toHaveLength(1);
    client.close();
  });

  test("an echo carrying fast false does not resolve a fast true subscription", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "l2Book", coin: "ETH", fast: true }, noop);

    socketOf().message({
      channel: "subscriptionResponse",
      data: {
        method: "subscribe",
        subscription: { type: "l2Book", coin: "ETH", mantissa: null, fast: false },
      },
    });
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(errors).toHaveLength(0);
    expect(subscriptionsOf()).toHaveLength(2);
    client.close();
  });

  test("exact echoes for other channels still resolve", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "allMids" }, noop);
    client.subscribe({ type: "candle", coin: "BTC", interval: "1m" }, noop);
    client.subscribe({ type: "userFills", user: "0xabc" }, noop);
    client.subscribe({ type: "clearinghouseState", user: "0xabc", dex: "main" }, noop);

    for (const subscription of subscriptionsOf()) {
      socketOf().message({
        channel: "subscriptionResponse",
        data: { method: "subscribe", subscription },
      });
    }
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(errors).toHaveLength(0);
    expect(subscriptionsOf()).toHaveLength(4);
    client.close();
  });
});

describe("l2Book fast/slow routing", () => {
  test("a fast frame reaches the fast subscriber and not the slow subscriber", async () => {
    const client = connect();
    const fast: unknown[] = [];
    const slow: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "xyz:CVX", fast: true }, (data) => {
      fast.push(data);
    });
    client.subscribe({ type: "l2Book", coin: "xyz:CVX", fast: false }, (data) => {
      slow.push(data);
    });

    socketOf().message(bookFrame("xyz:CVX", 5, true));
    await settle();

    expect(fast).toHaveLength(1);
    expect(slow).toHaveLength(0);
    client.close();
  });

  test("a slow frame reaches the slow subscriber and not the fast subscriber", async () => {
    const client = connect();
    const fast: unknown[] = [];
    const slow: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "BTC", fast: true }, (data) => {
      fast.push(data);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", fast: false }, (data) => {
      slow.push(data);
    });

    socketOf().message(bookFrame("BTC", 20));
    await settle();

    expect(slow).toHaveLength(1);
    expect(fast).toHaveLength(0);
    client.close();
  });

  test("a hub subscription without fast still receives slow frames", async () => {
    const client = connect();
    const received: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "BTC", nSigFigs: 5 }, (data) => {
      received.push(data);
    });

    socketOf().message(bookFrame("BTC", 20));
    await settle();

    expect(received).toHaveLength(1);
    client.close();
  });

  test("two nSigFigs on one coin with the same fast flag both receive frames without crossing legs", async () => {
    const client = connect();
    const five: unknown[] = [];
    const two: unknown[] = [];
    const fast: unknown[] = [];
    client.subscribe({ type: "l2Book", coin: "BTC", nSigFigs: 5 }, (data) => {
      five.push(data);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", nSigFigs: 2 }, (data) => {
      two.push(data);
    });
    client.subscribe({ type: "l2Book", coin: "BTC", fast: true }, (data) => {
      fast.push(data);
    });

    socketOf().message(bookFrame("BTC", 20));
    await settle();
    expect(five).toHaveLength(1);
    expect(two).toHaveLength(1);
    expect(fast).toHaveLength(0);

    socketOf().message(bookFrame("BTC", 5, true));
    await settle();
    expect(five).toHaveLength(1);
    expect(two).toHaveLength(1);
    expect(fast).toHaveLength(1);
    client.close();
  });
});

describe("non-book routing", () => {
  test("allMids, candle, userFills and clearinghouseState routing is unchanged", async () => {
    const client = connect();
    const mids: unknown[] = [];
    const candles: unknown[] = [];
    const fills: unknown[] = [];
    const states: unknown[] = [];
    client.subscribe({ type: "allMids" }, (data) => {
      mids.push(data);
    });
    client.subscribe({ type: "candle", coin: "BTC", interval: "15m" }, (data) => {
      candles.push(data);
    });
    client.subscribe({ type: "userFills", user: "0xabc" }, (data) => {
      fills.push(data);
    });
    client.subscribe({ type: "clearinghouseState", user: "0xabc", dex: "main" }, (data) => {
      states.push(data);
    });

    socketOf().message({ channel: "allMids", data: { mids: { BTC: "1" } } });
    socketOf().message({
      channel: "candle",
      data: [{ s: "BTC", i: "15m", t: 1, T: 2, o: 1, c: 1, h: 1, l: 1, v: 1, n: 1 }],
    });
    socketOf().message({ channel: "userFills", data: { user: "0xabc", fills: [] } });
    socketOf().message({
      channel: "clearinghouseState",
      data: { dex: "main", user: "0xabc", clearinghouseState: { marginSummary: {} } },
    });
    await settle();

    expect(mids).toHaveLength(1);
    expect(candles).toHaveLength(1);
    expect(fills).toHaveLength(1);
    expect(states).toHaveLength(1);
    client.close();
  });
});

describe("ack retry", () => {
  test("an unanswered subscribe retries twice then reports one error", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "l2Book", coin: "SOL", nSigFigs: 5 }, noop);

    expect(subscriptionsOf()).toHaveLength(1);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      jest.advanceTimersByTime(10_000);
      await settle();
    }
    expect(subscriptionsOf()).toHaveLength(3);
    expect(errors).toHaveLength(0);

    jest.advanceTimersByTime(10_000);
    await settle();
    expect(subscriptionsOf()).toHaveLength(3);
    expect(errors).toHaveLength(1);
    client.close();
  });

  test("a late ack after a retry still resolves the subscription", async () => {
    jest.useFakeTimers();
    const client = connect();
    const errors: unknown[] = [];
    client.onError((error) => {
      errors.push(error);
    });
    client.subscribe({ type: "l2Book", coin: "SOL", nSigFigs: 5 }, noop);

    jest.advanceTimersByTime(10_000);
    await settle();
    socketOf().message({
      channel: "subscriptionResponse",
      data: {
        method: "subscribe",
        subscription: { type: "l2Book", coin: "SOL", nSigFigs: 5, mantissa: null, fast: false },
      },
    });
    await settle();
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(subscriptionsOf()).toHaveLength(2);
    expect(errors).toHaveLength(0);
    client.close();
  });
});
