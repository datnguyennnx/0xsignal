import { afterEach, describe, expect, jest, test } from "bun:test";
import {
  SLOW_DROP_MS,
  SLOW_STALE_MS,
  type MergedBook,
} from "@0xsignal/sdk-hyperliquid/subscription";
import { createBookStream } from "./l2-book-stream";
import { toMarketFrame } from "./hl-market-stream";

type Level = { readonly px: string; readonly sz: string; readonly n: number };

const bids = (start: number, count: number, size: number): Level[] =>
  Array.from({ length: count }, (_, index) => ({
    px: String(start - index),
    sz: String(size),
    n: 1,
  }));

const asks = (start: number, count: number, size: number): Level[] =>
  Array.from({ length: count }, (_, index) => ({
    px: String(start + index),
    sz: String(size),
    n: 1,
  }));

const prices = (start: number, count: number, step: number): string[] =>
  Array.from({ length: count }, (_, index) => String(start + index * step));

const frame = (
  time: number,
  bidLevels: Level[],
  askLevels: Level[],
  fast?: boolean,
): { coin: string; levels: [Level[], Level[]]; time: number; fast?: boolean } => ({
  coin: "BTC",
  levels: [bidLevels, askLevels],
  time,
  ...(fast !== undefined && { fast }),
});

const fastBids = bids(74049, 5, 1);
const fastAsks = asks(74050, 5, 1);
const slowBids = bids(74046, 20, 9);
const slowAsks = asks(74047, 20, 9);

interface FakeSubscription {
  readonly subscription: { readonly fast: boolean };
  readonly onData: (event: unknown) => void;
}

interface FakeClient {
  readonly subscriptions: FakeSubscription[];
  unsubscribed: boolean;
  closed: boolean;
  subscribe(
    subscription: { readonly fast: boolean },
    onData: (event: unknown) => void,
  ): { unsubscribe(): void };
  close(): void;
}

const makeHarness = () => {
  const clients: FakeClient[] = [];
  const createClient = (): FakeClient => {
    const client: FakeClient = {
      subscriptions: [],
      unsubscribed: false,
      closed: false,
      subscribe: (subscription, onData) => {
        client.subscriptions.push({ subscription, onData });
        return {
          unsubscribe: () => {
            client.unsubscribed = true;
          },
        };
      },
      close: () => {
        client.closed = true;
      },
    };
    clients.push(client);
    return client;
  };
  return { clients, createClient };
};

const pxOf = (levels: readonly { readonly px: string }[]): string[] =>
  levels.map((level) => level.px);

const sizeOf = (levels: readonly { readonly sz: string }[]): string[] =>
  levels.map((level) => level.sz);

const fastClient = (clients: readonly FakeClient[]): FakeClient => {
  const client = clients.find((entry) => entry.subscriptions[0]?.subscription.fast === true);
  if (client === undefined) throw new Error("fast client not opened");
  return client;
};

const slowClient = (clients: readonly FakeClient[]): FakeClient => {
  const client = clients.find((entry) => entry.subscriptions[0]?.subscription.fast === false);
  if (client === undefined) throw new Error("slow client not opened");
  return client;
};

const emit = (client: FakeClient, event: unknown): void => {
  client.subscriptions[0]?.onData(event);
};

const flush = async (): Promise<void> => {
  await Promise.resolve();
};

const subscribeCaptured = (stream: ReturnType<typeof createBookStream>): MergedBook[] => {
  const received: MergedBook[] = [];
  stream.subscribe({ coin: "BTC", nSigFigs: 5 }, (snapshot) => received.push(snapshot));
  return received;
};

const subscribeCapturedWithErrors = (
  stream: ReturnType<typeof createBookStream>,
): { received: MergedBook[]; errors: Error[] } => {
  const received: MergedBook[] = [];
  const errors: Error[] = [];
  stream.subscribe(
    { coin: "BTC", nSigFigs: 5 },
    (snapshot) => received.push(snapshot),
    (error) => errors.push(error),
  );
  return { received, errors };
};

const fakeClock = (start: number): { now: () => number; set: (value: number) => void } => {
  let clock = start;
  return {
    now: () => clock,
    set: (value) => {
      clock = value;
    },
  };
};

afterEach(() => {
  jest.useRealTimers();
});

describe("book stream attribution", () => {
  test("the fast leg paints first with five levels and marks the slow leg degraded", async () => {
    const harness = makeHarness();
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => 1_000,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]?.degraded).toEqual(["slow"]);
    expect(received[0]?.levels[0]).toHaveLength(5);
    expect(received[0]?.levels[1]).toHaveLength(5);
  });

  test("two legs in one tick deliver exactly one merged snapshot", async () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient, now: () => 1_000 });
    const received = subscribeCaptured(stream);

    emit(slowClient(harness.clients), frame(1_000, slowBids, slowAsks));
    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();

    expect(received).toHaveLength(1);
    const merged = received[0];
    expect(merged?.degraded).toEqual([]);
    const bidPx = pxOf(merged?.levels[0] ?? []);
    const askPx = pxOf(merged?.levels[1] ?? []);
    expect(bidPx).toEqual(prices(74049, 20, -1));
    expect(askPx).toEqual(prices(74047, 20, 1));
    expect(bidPx.slice(0, 5)).toEqual(pxOf(fastBids));
    expect(askPx.slice(3, 8)).toEqual(pxOf(fastAsks));
    const bidSz = sizeOf(merged?.levels[0] ?? []);
    const askSz = sizeOf(merged?.levels[1] ?? []);
    expect(bidSz.slice(0, 5)).toEqual(Array(5).fill("1"));
    expect(bidSz.slice(5)).toEqual(Array(15).fill("9"));
    expect(askSz.slice(0, 3)).toEqual(Array(3).fill("9"));
    expect(askSz.slice(3, 8)).toEqual(Array(5).fill("1"));
    expect(askSz.slice(8)).toEqual(Array(12).fill("9"));
  });

  test("an identical merged snapshot does not emit again", async () => {
    const harness = makeHarness();
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => 1_000,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    expect(received).toHaveLength(1);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    expect(received).toHaveLength(1);
  });

  test("a soft-stale slow leg stays in the merge and is reported degraded", async () => {
    const harness = makeHarness();
    const clock = 10_000;
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => clock,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(slowClient(harness.clients), frame(clock - SLOW_STALE_MS - 1, slowBids, slowAsks));
    emit(fastClient(harness.clients), frame(clock, fastBids, fastAsks));
    await flush();

    const merged = received.at(-1);
    expect(merged?.degraded).toEqual(["slow"]);
    expect(pxOf(merged?.levels[0] ?? [])).toEqual(prices(74049, 20, -1));
    expect(pxOf(merged?.levels[1] ?? [])).toEqual(prices(74047, 20, 1));
  });

  test("a hard-stale slow leg is dropped and only the fast book remains", async () => {
    const harness = makeHarness();
    const clock = 10_000;
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => clock,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(slowClient(harness.clients), frame(clock - SLOW_DROP_MS - 1, slowBids, slowAsks));
    emit(fastClient(harness.clients), frame(clock, fastBids, fastAsks));
    await flush();

    const merged = received.at(-1);
    expect(merged?.degraded).toEqual(["slow"]);
    expect(pxOf(merged?.levels[0] ?? [])).toEqual(pxOf(fastBids));
    expect(merged?.levels[0]).toHaveLength(5);
    expect(pxOf(merged?.levels[1] ?? [])).toEqual(pxOf(fastAsks));
    expect(merged?.levels[1]).toHaveLength(5);
  });

  test("an out-of-order leg frame is dropped", async () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient, now: () => 2_000 });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(2_000, fastBids, fastAsks));
    emit(fastClient(harness.clients), frame(1_000, bids(100, 5, 1), asks(101, 5, 1)));
    emit(slowClient(harness.clients), frame(2_000, slowBids, slowAsks));
    await flush();

    expect(pxOf(received.at(-1)?.levels[0] ?? [])).toEqual(prices(74049, 20, -1));
  });

  test("a fast-socket frame flagged slow is rejected once and never emitted", async () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient, now: () => 1_000 });
    const { received, errors } = subscribeCapturedWithErrors(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks, false));
    emit(fastClient(harness.clients), frame(1_001, fastBids, fastAsks, false));
    await flush();

    expect(received).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  test("a slow-socket frame flagged fast is rejected once and never emitted", async () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient, now: () => 1_000 });
    const { received, errors } = subscribeCapturedWithErrors(stream);

    emit(slowClient(harness.clients), frame(1_000, slowBids, slowAsks, true));
    emit(slowClient(harness.clients), frame(1_001, slowBids, slowAsks, true));
    await flush();

    expect(received).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  test("a missing fast flag is accepted on both sockets", async () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient, now: () => 1_000 });
    const received = subscribeCaptured(stream);

    emit(slowClient(harness.clients), frame(1_000, slowBids, slowAsks));
    emit(fastClient(harness.clients), frame(1_001, fastBids, fastAsks));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]?.degraded).toEqual([]);
  });

  test("the merged emit carries the frame time and degraded legs", async () => {
    const harness = makeHarness();
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => 2_000,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_500, fastBids, fastAsks));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]?.time).toBe(1_500);
    expect(received[0]?.degraded).toEqual(["slow"]);
  });

  test("a recovered slow-only book is emitted with a time clamped to the last emit", async () => {
    const harness = makeHarness();
    let clock = 2_000;
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => clock,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(2_000, fastBids, fastAsks));
    await flush();
    expect(received).toHaveLength(1);
    expect(received[0]?.time).toBe(2_000);

    clock = 5_000;
    emit(slowClient(harness.clients), frame(1_500, slowBids, slowAsks));
    await flush();

    expect(received).toHaveLength(2);
    expect(received[1]?.time).toBeGreaterThanOrEqual(2_000);
    expect(received[1]?.degraded).toEqual(["fast"]);
    expect(received[1]?.levels[0]).toHaveLength(20);
  });

  test("the emitted time never regresses across progressively mixed frames", async () => {
    const harness = makeHarness();
    let clock = 1_000;
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => clock,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();

    clock = 2_000;
    emit(slowClient(harness.clients), frame(1_500, slowBids, slowAsks));
    await flush();

    emit(fastClient(harness.clients), frame(1_800, bids(70_000, 5, 2), asks(70_001, 5, 2)));
    await flush();

    expect(received.map((book) => book.time)).toEqual([1_000, 1_500, 1_800]);
  });

  test("identical levels with a newer time do not emit again", async () => {
    const harness = makeHarness();
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => 1_000,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    expect(received).toHaveLength(1);

    emit(fastClient(harness.clients), frame(1_100, fastBids, fastAsks));
    await flush();
    expect(received).toHaveLength(1);
  });
});

describe("book stream degraded settle window", () => {
  test("a degraded book is held while the entry is inside the settle window", async () => {
    jest.useFakeTimers();
    const harness = makeHarness();
    const clock = fakeClock(1_000);
    const stream = createBookStream({
      createClient: harness.createClient,
      now: clock.now,
      settleMs: 120,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();

    expect(received).toHaveLength(0);
    jest.advanceTimersByTime(119);
    expect(received).toHaveLength(0);
    jest.advanceTimersByTime(2);
    expect(received).toHaveLength(1);
    stream.close();
  });

  test("a slow leg inside the window delivers exactly one merged book", async () => {
    jest.useFakeTimers();
    const harness = makeHarness();
    const clock = fakeClock(1_000);
    const stream = createBookStream({
      createClient: harness.createClient,
      now: clock.now,
      settleMs: 120,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    clock.set(1_050);
    emit(slowClient(harness.clients), frame(1_050, slowBids, slowAsks));
    await flush();
    jest.advanceTimersByTime(1_000);

    expect(received).toHaveLength(1);
    expect(received[0]?.degraded).toEqual([]);
    expect(received[0]?.levels[0]).toHaveLength(20);
    expect(received.some((book) => book.levels[0].length === 5)).toBe(false);
    stream.close();
  });

  test("a degraded book appears once the settle window elapses", async () => {
    jest.useFakeTimers();
    const harness = makeHarness();
    const clock = fakeClock(1_000);
    const stream = createBookStream({
      createClient: harness.createClient,
      now: clock.now,
      settleMs: 120,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    expect(received).toHaveLength(0);

    clock.set(1_121);
    jest.advanceTimersByTime(121);

    expect(received).toHaveLength(1);
    expect(received[0]?.degraded).toEqual(["slow"]);
    expect(received[0]?.levels[0]).toHaveLength(5);

    jest.advanceTimersByTime(1_000);
    expect(received).toHaveLength(1);
    stream.close();
  });

  test("the default window holds for 120ms and releases one book at 121ms", async () => {
    jest.useFakeTimers();
    const harness = makeHarness();
    const clock = fakeClock(1_000);
    const stream = createBookStream({ createClient: harness.createClient, now: clock.now });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    jest.advanceTimersByTime(119);
    expect(received).toHaveLength(0);

    clock.set(1_121);
    jest.advanceTimersByTime(2);

    expect(received).toHaveLength(1);
    expect(received[0]?.degraded).toEqual(["slow"]);
    expect(received[0]?.levels[0]).toHaveLength(5);
    stream.close();
  });

  test("settleMs zero emits the degraded book immediately", async () => {
    const harness = makeHarness();
    const stream = createBookStream({
      createClient: harness.createClient,
      now: () => 1_000,
      settleMs: 0,
    });
    const received = subscribeCaptured(stream);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]?.degraded).toEqual(["slow"]);
    expect(received[0]?.levels[0]).toHaveLength(5);
    stream.close();
  });

  test("teardown before the timer fires delivers nothing", async () => {
    jest.useFakeTimers();
    const harness = makeHarness();
    const clock = fakeClock(1_000);
    const stream = createBookStream({
      createClient: harness.createClient,
      now: clock.now,
      settleMs: 120,
    });
    let calls = 0;
    const handle = stream.subscribe({ coin: "BTC", nSigFigs: 5 }, () => {
      calls += 1;
    });

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    handle.unsubscribe();
    clock.set(1_400);
    jest.advanceTimersByTime(1_000);

    expect(calls).toBe(0);
  });

  test("subscribers share one held snapshot and both receive it once", async () => {
    jest.useFakeTimers();
    const harness = makeHarness();
    const clock = fakeClock(1_000);
    const stream = createBookStream({
      createClient: harness.createClient,
      now: clock.now,
      settleMs: 120,
    });
    const first: MergedBook[] = [];
    const second: MergedBook[] = [];
    stream.subscribe({ coin: "BTC", nSigFigs: 5 }, (snapshot) => first.push(snapshot));
    stream.subscribe({ coin: "BTC", nSigFigs: 5 }, (snapshot) => second.push(snapshot));

    expect(harness.clients).toHaveLength(2);

    emit(fastClient(harness.clients), frame(1_000, fastBids, fastAsks));
    await flush();
    expect(first).toHaveLength(0);
    expect(second).toHaveLength(0);

    clock.set(1_121);
    jest.advanceTimersByTime(121);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]).toBe(second[0]);
    stream.close();
  });
});

describe("market frame time propagation", () => {
  const levels = [[{ px: "1", sz: "2", n: 1 }], []];

  test("an l2Book frame with an empty degraded list carries its time", () => {
    const frame = toMarketFrame({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 }, "ETH", {
      levels,
      time: 1_234,
      degraded: [],
    });

    expect(frame?.data).toEqual({ type: "snapshot", levels, time: 1_234, degraded: [] });
  });

  test("an l2Book frame without degraded carries its time", () => {
    const frame = toMarketFrame({ channel: "l2Book", symbol: "ETH", nSigFigs: 5 }, "ETH", {
      levels,
      time: 1_234,
    });

    expect(frame?.data).toEqual({ type: "snapshot", levels, time: 1_234 });
  });

  test("non-book frames carry no time", () => {
    const frame = toMarketFrame({ channel: "allMids", symbol: "ETH" }, "ETH", {
      mids: { ETH: "1" },
      time: 1_234,
    });

    expect(frame?.data).toEqual({ ETH: "1" });
  });
});

describe("book stream lifecycle", () => {
  test("subscribers for one coin share a pair of sockets and the last release tears down", () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient });
    const first = stream.subscribe({ coin: "BTC", nSigFigs: 5 }, () => {});
    const second = stream.subscribe({ coin: "BTC", nSigFigs: 5 }, () => {});

    expect(harness.clients).toHaveLength(2);

    first.unsubscribe();
    expect(harness.clients.every((client) => client.unsubscribed)).toBe(false);
    expect(harness.clients.every((client) => client.closed)).toBe(false);

    second.unsubscribe();
    expect(harness.clients.every((client) => client.unsubscribed)).toBe(true);
    expect(harness.clients.every((client) => client.closed)).toBe(true);
  });

  test("close tears down both clients and their subscriptions", () => {
    const harness = makeHarness();
    const stream = createBookStream({ createClient: harness.createClient });
    stream.subscribe({ coin: "BTC", nSigFigs: 5 }, () => {});

    stream.close();

    expect(harness.clients).toHaveLength(2);
    expect(harness.clients.every((client) => client.unsubscribed)).toBe(true);
    expect(harness.clients.every((client) => client.closed)).toBe(true);
  });
});
