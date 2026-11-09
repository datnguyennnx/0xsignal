/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { UserFill } from "@0xsignal/shared";

import { createUserStreamClient, UserStreamLimitError } from "./user-stream-client";
import type { TabChannel } from "./user-stream-coordination";
import {
  mergeUserFills,
  USER_STREAM_LIMITS,
  type ClearinghouseStreamEvent,
  type OpenOrdersStreamEvent,
  type SpotStateStreamEvent,
  type UpstreamSubscription,
  type UserFillsStreamEvent,
  type UserStreamConnectionState,
  type UserStreamFailure,
  type UserStreamUpstream,
} from "./user-stream-types";

const address = (index: number): string => `0x${index.toString(16).padStart(40, "0")}`;

const fill = (tid: number, time: number): UserFill => ({
  coin: "BTC",
  side: "B",
  sz: "1",
  px: "100",
  fee: "0",
  hash: `0x${tid.toString(16).padStart(64, "0")}`,
  oid: tid,
  tid,
  time,
});

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const noop = (): void => {};

interface ResumeSource {
  readonly subscribe: (listener: () => void) => () => void;
  readonly fire: () => void;
  readonly listenerCount: () => number;
}

const makeResumeSource = (): ResumeSource => {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    fire: () => {
      for (const listener of Array.from(listeners)) listener();
    },
    listenerCount: () => listeners.size,
  };
};

const failureKind = (failure: UserStreamFailure | null): string | null => failure?.kind ?? null;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : "");

class FakeUpstream implements UserStreamUpstream {
  private connectionState: UserStreamConnectionState = "open";
  private readonly stateListeners = new Set<(state: UserStreamConnectionState) => void>();
  private readonly clearinghouseListeners: Array<(event: ClearinghouseStreamEvent) => void> = [];
  private readonly spotListeners: Array<(event: SpotStateStreamEvent) => void> = [];
  private readonly fillsListeners: Array<(event: UserFillsStreamEvent) => void> = [];
  private readonly openOrdersListeners: Array<(event: OpenOrdersStreamEvent) => void> = [];

  userFillsSubscribes = 0;
  clearinghouseSubscribes = 0;
  unsubscribeCount = 0;
  reconnectCount = 0;
  stale = false;
  disposed = false;
  rejectUserFills = false;
  holdSubscribes = false;
  private readonly pendingSubscribes: Array<() => void> = [];

  subscribeClearinghouseState(
    _user: string,
    listener: (event: ClearinghouseStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.clearinghouseSubscribes += 1;
    this.clearinghouseListeners.push(listener);
    return this.makeSubscriptionPromise();
  }

  subscribeSpotState(
    _user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.spotListeners.push(listener);
    return this.makeSubscriptionPromise();
  }

  subscribeUserFills(
    _user: string,
    listener: (event: UserFillsStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.userFillsSubscribes += 1;
    if (this.rejectUserFills) return Promise.reject(new Error("subscribe rejected"));
    this.fillsListeners.push(listener);
    return this.makeSubscriptionPromise();
  }

  subscribeOpenOrders(
    _user: string,
    listener: (event: OpenOrdersStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.openOrdersListeners.push(listener);
    return this.makeSubscriptionPromise();
  }

  releaseSubscribes(): void {
    for (const release of this.pendingSubscribes.splice(0)) release();
  }

  emitUserFills(event: UserFillsStreamEvent): void {
    for (const listener of this.fillsListeners) listener(event);
  }

  close(): void {
    this.connectionState = "closed";
    for (const listener of this.stateListeners) listener("closed");
  }

  getConnectionState(): UserStreamConnectionState {
    return this.connectionState;
  }

  onConnectionStateChange(listener: (state: UserStreamConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  reconnect(): void {
    this.reconnectCount += 1;
  }

  isStale(): boolean {
    return this.stale;
  }

  dispose(): void {
    this.disposed = true;
  }

  private makeSubscriptionPromise(): Promise<UpstreamSubscription> {
    if (!this.holdSubscribes) return Promise.resolve(this.makeSubscription());
    return new Promise((resolve) => {
      this.pendingSubscribes.push(() => resolve(this.makeSubscription()));
    });
  }

  private makeSubscription(): UpstreamSubscription {
    return {
      unsubscribe: () => {
        this.unsubscribeCount += 1;
        return Promise.resolve();
      },
    };
  }
}

const makeClient = (upstream: FakeUpstream, resume?: ResumeSource) =>
  createUserStreamClient({
    createUpstream: () => upstream,
    ...(resume === undefined ? {} : { subscribePageResume: resume.subscribe }),
  });

const isKind = (message: unknown, kind: string): boolean =>
  typeof message === "object" &&
  message !== null &&
  "kind" in message &&
  (message as { kind?: unknown }).kind === kind;

class FakeTabChannel implements TabChannel {
  readonly sent: unknown[] = [];
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    if (type === "message") this.listeners.add(listener);
  }

  send(message: unknown): void {
    this.sent.push(message);
  }

  close(): void {}

  receive(message: unknown): void {
    for (const listener of this.listeners) {
      listener(new MessageEvent("message", { data: message }));
    }
  }

  countSent(kind: string): number {
    return this.sent.filter((message) => isKind(message, kind)).length;
  }
}

const makeCoordinatedClient = (upstream: FakeUpstream, channel: FakeTabChannel, tabId: string) =>
  createUserStreamClient({
    createUpstream: () => upstream,
    createBroadcastChannel: () => channel,
    tabId,
    electionDelayMs: 0,
  });

describe("user-stream-client caps", () => {
  test("rejects the 11th unique user with a clear limit error", async () => {
    const upstream = new FakeUpstream();
    const client = makeClient(upstream);

    const active = await Promise.all(
      Array.from({ length: USER_STREAM_LIMITS.uniqueUsers }, (_unused, index) =>
        client.subscribeClearinghouseState(address(index), noop),
      ),
    );

    const attempt = client.subscribeClearinghouseState(
      address(USER_STREAM_LIMITS.uniqueUsers),
      noop,
    );
    const caught = await attempt.then(
      () => null,
      (error: unknown) => error,
    );

    expect(caught).toBeInstanceOf(UserStreamLimitError);
    expect(errorMessage(caught)).toContain("10 unique users");

    for (const subscription of active) subscription.unsubscribe();
  });
});

describe("user-stream-client refcount", () => {
  test("shares one upstream subscription and tears down on the last release", async () => {
    const upstream = new FakeUpstream();
    const client = makeClient(upstream);

    const first = await client.subscribeUserFills(address(1), noop);
    const second = await client.subscribeUserFills(address(1), noop);

    expect(upstream.userFillsSubscribes).toBe(1);

    first.unsubscribe();
    await flush();
    expect(upstream.unsubscribeCount).toBe(0);

    second.unsubscribe();
    await flush();
    expect(upstream.unsubscribeCount).toBe(1);
    expect(upstream.disposed).toBe(true);
  });
});

describe("user-stream-client snapshot handling", () => {
  test("a snapshot replaces state and an update merges without duplicates", () => {
    const current = [fill(1, 100), fill(2, 200)];

    const replaced = mergeUserFills(current, { data: [fill(9, 300)], isSnapshot: true });
    expect(replaced.map((entry) => entry.tid)).toEqual([9]);

    const merged = mergeUserFills(current, {
      data: [fill(3, 300), fill(2, 200)],
      isSnapshot: false,
    });
    expect(merged.map((entry) => entry.tid)).toEqual([3, 2, 1]);
  });

  test("surfaces the wire snapshot flag to listeners", async () => {
    const upstream = new FakeUpstream();
    const client = makeClient(upstream);
    const events: UserFillsStreamEvent[] = [];

    const subscription = await client.subscribeUserFills(address(1), (event) => {
      events.push(event);
    });

    upstream.emitUserFills({ data: [fill(1, 100)], isSnapshot: true });
    upstream.emitUserFills({ data: [fill(2, 200)], isSnapshot: false });

    expect(events.map((event) => event.isSnapshot)).toEqual([true, false]);

    subscription.unsubscribe();
  });
});

describe("user-stream-client connection state", () => {
  test("reports connection changes so callers can fall back to REST", async () => {
    const upstream = new FakeUpstream();
    const client = makeClient(upstream);
    const states: UserStreamConnectionState[] = [];
    const stop = client.onConnectionStateChange((state) => {
      states.push(state);
    });

    const subscription = await client.subscribeClearinghouseState(address(1), noop);
    expect(client.getConnectionState()).toBe("open");

    upstream.close();
    expect(client.getConnectionState()).toBe("closed");
    expect(states).toEqual(["open", "closed"]);

    subscription.unsubscribe();
    stop();
  });
});

describe("user-stream-client failure model", () => {
  test("a rejected subscribe is observable, not swallowed", async () => {
    const upstream = new FakeUpstream();
    upstream.rejectUserFills = true;
    const client = makeClient(upstream);
    const failures: Array<string | null> = [];
    client.onFailureChange((failure) => {
      failures.push(failureKind(failure));
    });

    const caught = await client
      .subscribeUserFills(address(1), noop)
      .then(() => null)
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(Error);
    expect(client.getLastFailure()?.kind).toBe("subscribe-rejected");
    expect(failures).toEqual(["subscribe-rejected"]);
  });

  test("an empty user surfaces the typed auth-less failure", async () => {
    const upstream = new FakeUpstream();
    const client = makeClient(upstream);

    const caught = await client
      .subscribeClearinghouseState("", noop)
      .then(() => null)
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(Error);
    expect(client.getLastFailure()?.kind).toBe("auth-required");
  });
});

describe("user-stream-client remote registration", () => {
  test("concurrent adds for one key keep exactly one live handle", async () => {
    const upstream = new FakeUpstream();
    const channel = new FakeTabChannel();
    const client = makeCoordinatedClient(upstream, channel, "leader");
    await flush();

    const user = address(1);
    const request = {
      key: `clearinghouseState:${user}`,
      user,
      channel: "clearinghouseState",
    };
    upstream.holdSubscribes = true;

    channel.receive({ kind: "subscribe", ...request, tabId: "tab-a" });
    channel.receive({ kind: "subscribe", ...request, tabId: "tab-b" });
    await flush();

    expect(upstream.clearinghouseSubscribes).toBe(1);

    upstream.releaseSubscribes();
    await flush();

    // Both tabs stay associated with the one stored handle; when they both
    // leave, that handle releases the shared upstream subscription exactly once.
    channel.receive({ kind: "unsubscribe", ...request, tabId: "tab-a" });
    channel.receive({ kind: "unsubscribe", ...request, tabId: "tab-b" });
    await flush();

    expect(upstream.unsubscribeCount).toBe(1);
    expect(upstream.disposed).toBe(true);

    client.dispose();
    await flush();
    expect(upstream.unsubscribeCount).toBe(1);
  });

  test("sequential adds reuse the existing remote entry", async () => {
    const upstream = new FakeUpstream();
    const channel = new FakeTabChannel();
    const client = makeCoordinatedClient(upstream, channel, "leader");
    await flush();

    const user = address(1);
    const request = {
      key: `clearinghouseState:${user}`,
      user,
      channel: "clearinghouseState",
    };

    channel.receive({ kind: "subscribe", ...request, tabId: "tab-a" });
    await flush();
    channel.receive({ kind: "subscribe", ...request, tabId: "tab-b" });
    await flush();

    expect(upstream.clearinghouseSubscribes).toBe(1);
    expect(upstream.unsubscribeCount).toBe(0);

    client.dispose();
    await flush();
    expect(upstream.unsubscribeCount).toBe(1);
  });
});

describe("user-stream-client page resume", () => {
  test("a stale upstream reconnects exactly once on resume", async () => {
    const resume = makeResumeSource();
    const upstream = new FakeUpstream();
    upstream.stale = true;
    const client = makeClient(upstream, resume);

    const subscription = await client.subscribeUserFills(address(1), noop);
    resume.fire();
    expect(upstream.reconnectCount).toBe(1);

    subscription.unsubscribe();
    client.dispose();
  });

  test("a fresh upstream is left alone on resume", async () => {
    const resume = makeResumeSource();
    const upstream = new FakeUpstream();
    const client = makeClient(upstream, resume);

    const subscription = await client.subscribeUserFills(address(1), noop);
    resume.fire();
    expect(upstream.reconnectCount).toBe(0);

    subscription.unsubscribe();
    client.dispose();
  });

  test("dispose removes the resume listener so a later resume is inert", async () => {
    const resume = makeResumeSource();
    const upstream = new FakeUpstream();
    upstream.stale = true;
    const client = makeClient(upstream, resume);

    const subscription = await client.subscribeUserFills(address(1), noop);
    expect(resume.listenerCount()).toBe(1);

    client.dispose();
    expect(resume.listenerCount()).toBe(0);

    resume.fire();
    expect(upstream.reconnectCount).toBe(0);

    subscription.unsubscribe();
  });

  test("releasing the last subscription removes the resume listener", async () => {
    const resume = makeResumeSource();
    const upstream = new FakeUpstream();
    const client = makeClient(upstream, resume);

    const subscription = await client.subscribeUserFills(address(1), noop);
    expect(resume.listenerCount()).toBe(1);

    subscription.unsubscribe();
    await flush();
    expect(resume.listenerCount()).toBe(0);

    client.dispose();
  });
});

describe("user-stream-client pagehide", () => {
  test("pagehide says bye once, tears down once, and is idempotent with dispose", async () => {
    const pagehideListeners = new Set<() => void>();
    const fakeWindow = {
      addEventListener: (type: string, listener: () => void) => {
        if (type === "pagehide") pagehideListeners.add(listener);
      },
      removeEventListener: (type: string, listener: () => void) => {
        if (type === "pagehide") pagehideListeners.delete(listener);
      },
    };
    const globalWithWindow = globalThis as { window?: unknown };
    const previousWindow = globalWithWindow.window;
    globalWithWindow.window = fakeWindow;

    try {
      const upstream = new FakeUpstream();
      const channel = new FakeTabChannel();
      const client = makeCoordinatedClient(upstream, channel, "pagehide-tab");
      await flush();

      const subscription = await client.subscribeClearinghouseState(address(1), noop);
      expect(upstream.disposed).toBe(false);
      expect(pagehideListeners.size).toBe(1);

      const handler = [...pagehideListeners][0];
      handler();
      expect(channel.countSent("bye")).toBe(1);
      expect(upstream.disposed).toBe(true);
      expect(pagehideListeners.size).toBe(0);

      handler();
      client.dispose();
      expect(channel.countSent("bye")).toBe(1);

      subscription.unsubscribe();
    } finally {
      if (previousWindow === undefined) delete globalWithWindow.window;
      else globalWithWindow.window = previousWindow;
    }
  });
});
