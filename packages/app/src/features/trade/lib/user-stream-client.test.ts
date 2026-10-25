/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { UserFill } from "@0xsignal/shared";

import {
  createUserStreamClient,
  mergeUserFills,
  UserStreamLimitError,
  USER_STREAM_LIMITS,
  type ClearinghouseStreamEvent,
  type OpenOrdersStreamEvent,
  type SpotStateStreamEvent,
  type UpstreamSubscription,
  type UserFillsStreamEvent,
  type UserStreamConnectionState,
  type UserStreamUpstream,
} from "./user-stream-client";

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

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : "");

class FakeUpstream implements UserStreamUpstream {
  private connectionState: UserStreamConnectionState = "open";
  private readonly stateListeners = new Set<(state: UserStreamConnectionState) => void>();
  private readonly clearinghouseListeners: Array<(event: ClearinghouseStreamEvent) => void> = [];
  private readonly spotListeners: Array<(event: SpotStateStreamEvent) => void> = [];
  private readonly fillsListeners: Array<(event: UserFillsStreamEvent) => void> = [];
  private readonly openOrdersListeners: Array<(event: OpenOrdersStreamEvent) => void> = [];

  userFillsSubscribes = 0;
  unsubscribeCount = 0;
  disposed = false;

  subscribeClearinghouseState(
    _user: string,
    listener: (event: ClearinghouseStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.clearinghouseListeners.push(listener);
    return Promise.resolve(this.makeSubscription());
  }

  subscribeSpotState(
    _user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.spotListeners.push(listener);
    return Promise.resolve(this.makeSubscription());
  }

  subscribeUserFills(
    _user: string,
    listener: (event: UserFillsStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.userFillsSubscribes += 1;
    this.fillsListeners.push(listener);
    return Promise.resolve(this.makeSubscription());
  }

  subscribeOpenOrders(
    _user: string,
    listener: (event: OpenOrdersStreamEvent) => void,
  ): Promise<UpstreamSubscription> {
    this.openOrdersListeners.push(listener);
    return Promise.resolve(this.makeSubscription());
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

  dispose(): void {
    this.disposed = true;
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

const makeClient = (upstream: FakeUpstream) =>
  createUserStreamClient({ createUpstream: () => upstream });

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
