/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { WsClient } from "@0xsignal/sdk-hyperliquid";

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

type WireSubscription = { readonly type: string } & Record<string, unknown>;

interface FakeSubscription {
  readonly subscription: WireSubscription;
  readonly listener: (data: unknown) => void;
  readonly onError: ((error: Error) => void) | undefined;
}

const makeFakeClient = () => {
  const subscriptions: FakeSubscription[] = [];
  const statusListeners = new Set<(status: string) => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  const abortListeners = new Set<() => void>();
  let reconnects = 0;
  let closes = 0;

  return {
    subscriptions,
    get reconnects(): number {
      return reconnects;
    },
    get closes(): number {
      return closes;
    },
    subscribe(
      subscription: WireSubscription,
      listener: (data: unknown) => void,
      options: { onError?: (error: Error) => void } = {},
    ) {
      subscriptions.push({ subscription, listener, onError: options.onError });
      return {
        subscription,
        unsubscribe: () => {},
        unsubscribeAsync: () => Promise.resolve(),
      };
    },
    onStatus(listener: (status: string) => void) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    onError(listener: (error: unknown) => void) {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    terminationSignal: {
      addEventListener(type: string, listener: () => void) {
        if (type === "abort") abortListeners.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        if (type === "abort") abortListeners.delete(listener);
      },
      listenerCount(type: string): number {
        return type === "abort" ? abortListeners.size : 0;
      },
    },
    statusListenerCount: (): number => statusListeners.size,
    errorListenerCount: (): number => errorListeners.size,
    emitStatus(status: string) {
      for (const listener of Array.from(statusListeners)) listener(status);
    },
    emit(type: string, data: unknown) {
      for (const subscription of subscriptions) {
        if (subscription.subscription.type === type) subscription.listener(data);
      }
    },
    fail(type: string, error: Error) {
      for (const subscription of subscriptions) {
        if (subscription.subscription.type === type) subscription.onError?.(error);
      }
    },
    reconnect() {
      reconnects += 1;
    },
    close() {
      closes += 1;
    },
  };
};

const makeUpstream = () => {
  const client = makeFakeClient();
  const upstream = createHyperliquidUpstream({
    createClient: () => client as unknown as WsClient,
  });
  return { client, upstream };
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
      const { client, upstream } = makeUpstream();
      const user = address(1);
      await upstream.subscribeClearinghouseState(user, noop);
      expect(client.subscriptions[0]?.subscription).toEqual({
        type: "clearinghouseState",
        user,
        dex: "",
      });

      clock.advance(STALE_UPSTREAM_MS + 1);
      expect(upstream.isStale()).toBe(true);

      client.emit("clearinghouseState", {
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
      const { client, upstream } = makeUpstream();

      upstream.reconnect();
      expect(client.reconnects).toBe(1);

      clock.advance(RECONNECT_COOLDOWN_MS - 1);
      upstream.reconnect();
      expect(client.reconnects).toBe(1);

      clock.advance(1);
      upstream.reconnect();
      expect(client.reconnects).toBe(2);

      upstream.dispose();
    });
  });

  test("dispose makes a later reconnect a no-op", async () => {
    await withClock(async () => {
      const { client, upstream } = makeUpstream();

      upstream.dispose();
      upstream.reconnect();

      expect(client.reconnects).toBe(0);
    });
  });
});

describe("user-stream-upstream teardown", () => {
  test("dispose detaches every client and termination listener and closes the client", async () => {
    await withClock(async () => {
      const { client, upstream } = makeUpstream();
      expect(client.statusListenerCount()).toBe(1);
      expect(client.errorListenerCount()).toBe(1);
      expect(client.terminationSignal.listenerCount("abort")).toBe(1);

      upstream.dispose();

      expect(client.statusListenerCount()).toBe(0);
      expect(client.errorListenerCount()).toBe(0);
      expect(client.terminationSignal.listenerCount("abort")).toBe(0);
      expect(client.closes).toBe(1);

      // A late status event reaches no listener and cannot revive the state.
      client.emitStatus("open");
      expect(upstream.getConnectionState()).toBe("closed");
    });
  });
});

describe("user-stream-upstream subscription errors", () => {
  test("a failed resubscribe marks the upstream disconnected and surfaces the error", async () => {
    await withClock(async () => {
      const { client, upstream } = makeUpstream();
      const states: UserStreamConnectionState[] = [];
      const errors: Error[] = [];
      upstream.onConnectionStateChange((state) => {
        states.push(state);
      });
      upstream.onError?.((error) => {
        errors.push(error);
      });

      await upstream.subscribeUserFills(address(1), noop);
      client.emitStatus("open");
      expect(upstream.getConnectionState()).toBe("open");

      client.fail("userFills", new Error("resubscribe rejected"));

      expect(upstream.getConnectionState()).toBe("connecting");
      expect(states).toEqual(["open", "connecting"]);
      expect(errors[0]?.message).toContain("resubscribe rejected");

      upstream.dispose();
    });
  });
});
