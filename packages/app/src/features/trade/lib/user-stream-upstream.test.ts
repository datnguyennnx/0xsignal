/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { WebSocketTransport } from "@nktkas/hyperliquid";

import {
  createHyperliquidUpstream,
  RECONNECT_COOLDOWN_MS,
  STALE_UPSTREAM_MS,
} from "./user-stream-upstream";
import type { UserStreamConnectionState } from "./user-stream-types";

const address = (index: number): string => `0x${index.toString(16).padStart(40, "0")}`;

const noop = (): void => {};

interface Clock {
  advance(ms: number): void;
}

/** Both staleness and the cooldown read Date.now, so tests drive one virtual clock. */
const withClock = async <T>(run: (clock: Clock) => Promise<T>): Promise<T> => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    return await run({
      advance: (ms) => {
        now += ms;
      },
    });
  } finally {
    Date.now = realNow;
  }
};

interface FakeSocket {
  reconnectCount: number;
  reconnect(): void;
  addEventListener(type: string, listener: () => void): void;
  dispatch(type: string): void;
  readonly terminationSignal: AbortSignal;
}

const makeFakeSocket = (): FakeSocket => {
  const listeners = new Map<string, Set<() => void>>();
  const controller = new AbortController();
  return {
    reconnectCount: 0,
    reconnect() {
      this.reconnectCount += 1;
    },
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set<() => void>();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    dispatch(type) {
      for (const listener of Array.from(listeners.get(type) ?? [])) listener();
    },
    terminationSignal: controller.signal,
  };
};

interface FakeSubscription {
  readonly channel: string;
  readonly listener: (event: CustomEvent<unknown>) => void;
  readonly onError: ((error: Error) => void) | undefined;
}

interface FakeTransport {
  readonly socket: FakeSocket;
  readonly subscriptions: FakeSubscription[];
  subscribe(
    channel: string,
    payload: unknown,
    listener: (event: CustomEvent<unknown>) => void,
    options?: { onError?: (error: Error) => void },
  ): Promise<{ unsubscribe(): Promise<void> }>;
  emit(channel: string, detail: unknown): void;
  fail(channel: string, error: Error): void;
  close(): void;
}

const makeFakeTransport = (): FakeTransport => {
  const socket = makeFakeSocket();
  const subscriptions: FakeSubscription[] = [];
  return {
    socket,
    subscriptions,
    subscribe(channel, _payload, listener, options) {
      subscriptions.push({ channel, listener, onError: options?.onError });
      return Promise.resolve({ unsubscribe: () => Promise.resolve() });
    },
    emit(channel, detail) {
      for (const subscription of subscriptions) {
        if (subscription.channel !== channel) continue;
        subscription.listener(new CustomEvent(channel, { detail }));
      }
    },
    fail(channel, error) {
      for (const subscription of subscriptions) {
        if (subscription.channel === channel) subscription.onError?.(error);
      }
    },
    close() {},
  };
};

const makeUpstream = () => {
  const transport = makeFakeTransport();
  const upstream = createHyperliquidUpstream({
    createTransport: () => transport as unknown as WebSocketTransport,
  });
  return { transport, upstream };
};

describe("user-stream-upstream staleness", () => {
  test("isStale treats the boundary as fresh and one ms more as stale", async () => {
    await withClock(async (clock) => {
      const { upstream } = makeUpstream();

      expect(upstream.isStale(1_000)).toBe(false);
      clock.advance(1_000);
      expect(upstream.isStale(1_000)).toBe(false);
      clock.advance(1);
      expect(upstream.isStale(1_000)).toBe(true);

      upstream.dispose();
    });
  });

  test("the default window is 65s", async () => {
    await withClock(async (clock) => {
      const { upstream } = makeUpstream();

      clock.advance(STALE_UPSTREAM_MS);
      expect(upstream.isStale()).toBe(false);
      clock.advance(1);
      expect(upstream.isStale()).toBe(true);

      upstream.dispose();
    });
  });

  test("an inbound subscription event refreshes staleness", async () => {
    await withClock(async (clock) => {
      const { transport, upstream } = makeUpstream();
      const user = address(1);
      await upstream.subscribeClearinghouseState(user, noop);

      clock.advance(STALE_UPSTREAM_MS + 1);
      expect(upstream.isStale()).toBe(true);

      transport.emit("clearinghouseState", {
        user,
        dex: "",
        clearinghouseState: { marginSummary: {} },
      });
      expect(upstream.isStale()).toBe(false);

      upstream.dispose();
    });
  });
});

describe("user-stream-upstream reconnect", () => {
  test("a resume burst inside the cooldown forces one reconnect", async () => {
    await withClock(async (clock) => {
      const { transport, upstream } = makeUpstream();

      upstream.reconnect();
      expect(transport.socket.reconnectCount).toBe(1);

      clock.advance(RECONNECT_COOLDOWN_MS - 1);
      upstream.reconnect();
      expect(transport.socket.reconnectCount).toBe(1);

      clock.advance(1);
      upstream.reconnect();
      expect(transport.socket.reconnectCount).toBe(2);

      upstream.dispose();
    });
  });

  test("dispose makes a later reconnect a no-op", async () => {
    await withClock(async () => {
      const { transport, upstream } = makeUpstream();

      upstream.dispose();
      upstream.reconnect();

      expect(transport.socket.reconnectCount).toBe(0);
    });
  });
});

describe("user-stream-upstream subscription errors", () => {
  test("a failed resubscribe marks the upstream disconnected and surfaces the error", async () => {
    await withClock(async () => {
      const { transport, upstream } = makeUpstream();
      const states: UserStreamConnectionState[] = [];
      const errors: Error[] = [];
      upstream.onConnectionStateChange((state) => {
        states.push(state);
      });
      upstream.onError?.((error) => {
        errors.push(error);
      });

      await upstream.subscribeUserFills(address(1), noop);
      transport.socket.dispatch("open");
      expect(upstream.getConnectionState()).toBe("open");

      transport.fail("userFills", new Error("resubscribe rejected"));

      expect(upstream.getConnectionState()).toBe("connecting");
      expect(states).toEqual(["open", "connecting"]);
      expect(errors[0]?.message).toContain("resubscribe rejected");

      upstream.dispose();
    });
  });
});
