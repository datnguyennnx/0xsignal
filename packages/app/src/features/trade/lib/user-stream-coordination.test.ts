/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

import type { ClearinghouseState } from "@0xsignal/shared";
import type {
  ClearinghouseStreamEvent,
  UserStreamConnectionState,
  UserStreamUpstream,
} from "./user-stream-types";
import { createUserStreamClient } from "./user-stream-client";
import {
  createTabCoordinator,
  TAB_MISSED_PONG_LIMIT,
  TAB_PING_INTERVAL_MS,
  type TabChannel,
} from "./user-stream-coordination";

const ADDRESS = "0x0000000000000000000000000000000000000001";

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

const state = (value: string): ClearinghouseState => ({
  marginSummary: {
    accountValue: value,
    totalNtlPos: "0",
    totalRawUsd: "0",
    totalMarginUsed: "0",
  },
  crossMarginSummary: {
    accountValue: value,
    totalNtlPos: "0",
    totalRawUsd: "0",
    totalMarginUsed: "0",
  },
  crossMaintenanceMarginUsed: "0",
  withdrawable: "0",
  assetPositions: [],
  time: 0,
});

const channels = new Map<string, Set<FakeChannel>>();

class FakeChannel implements TabChannel {
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(private readonly name: string) {
    const peers = channels.get(name) ?? new Set<FakeChannel>();
    peers.add(this);
    channels.set(name, peers);
  }

  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void {
    if (type === "message") this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  deliver(message: unknown): void {
    for (const listener of this.listeners) {
      listener(new MessageEvent("message", { data: message }));
    }
  }

  send(message: unknown): void {
    for (const peer of channels.get(this.name) ?? []) {
      if (peer === this) continue;
      queueMicrotask(() => {
        for (const listener of peer.listeners) {
          listener(new MessageEvent("message", { data: message }));
        }
      });
    }
  }

  close(): void {
    channels.get(this.name)?.delete(this);
  }
}

class CountingUpstream implements UserStreamUpstream {
  clearinghouseSubscribes = 0;
  disposed = false;
  private listener: ((event: ClearinghouseStreamEvent) => void) | null = null;

  subscribeClearinghouseState(
    _user: string,
    listener: (event: ClearinghouseStreamEvent) => void,
  ): Promise<{ unsubscribe(): Promise<void> }> {
    this.clearinghouseSubscribes += 1;
    this.listener = listener;
    return Promise.resolve({ unsubscribe: () => Promise.resolve() });
  }

  subscribeSpotState(): Promise<{ unsubscribe(): Promise<void> }> {
    return Promise.resolve({ unsubscribe: () => Promise.resolve() });
  }

  subscribeUserFills(): Promise<{ unsubscribe(): Promise<void> }> {
    return Promise.resolve({ unsubscribe: () => Promise.resolve() });
  }

  subscribeOpenOrders(): Promise<{ unsubscribe(): Promise<void> }> {
    return Promise.resolve({ unsubscribe: () => Promise.resolve() });
  }

  getConnectionState(): UserStreamConnectionState {
    return "open";
  }

  onConnectionStateChange(): () => void {
    return () => {};
  }

  reconnect(): void {}

  isStale(): boolean {
    return false;
  }

  emit(event: ClearinghouseStreamEvent): void {
    this.listener?.(event);
  }

  dispose(): void {
    this.disposed = true;
  }
}

const makeClient = (upstream: CountingUpstream, tabId: string) =>
  createUserStreamClient({
    createUpstream: () => upstream,
    createBroadcastChannel: (name) => new FakeChannel(name),
    tabId,
    electionDelayMs: 0,
  });

interface TestEvent {
  readonly data: unknown;
}

const settle = async (): Promise<void> => {
  for (let index = 0; index < 5; index += 1) {
    // Bun's fake timers queue the channel's microtask deliveries as timers, so
    // they only drain when time actually advances.
    jest.advanceTimersByTime(1);
    await Promise.resolve();
  }
};

const makeCoordinator = (tabId: string, gone: string[]) =>
  createTabCoordinator<TestEvent>({
    createChannel: (name) => new FakeChannel(name),
    tabId,
    electionDelayMs: 0,
    isEvent: (value): value is TestEvent =>
      typeof value === "object" && value !== null && "data" in value,
    onPromote: () => {},
    onDemote: () => {},
    onRemoteSubscribe: () => {},
    onRemoteUnsubscribe: () => {},
    onRemoteTabGone: (id) => {
      gone.push(id);
    },
    onRemoteData: () => {},
    onLeaderState: () => {},
  });

describe("user stream tab liveness", () => {
  beforeEach(() => {
    channels.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    channels.clear();
  });

  test("a follower that never answers pings is pruned after two intervals", async () => {
    jest.useFakeTimers();
    const gone: string[] = [];
    const leader = makeCoordinator("leader", gone);
    jest.advanceTimersByTime(1);
    await settle();
    expect(leader.role()).toBe("leader");

    const ghost = new FakeChannel("0xsignal:user-stream:v1");
    ghost.send({
      kind: "subscribe",
      key: "clearinghouseState:0x01",
      user: ADDRESS,
      channel: "clearinghouseState",
      tabId: "ghost",
    });
    await settle();

    jest.advanceTimersByTime(TAB_PING_INTERVAL_MS * (TAB_MISSED_PONG_LIMIT - 1));
    await settle();
    expect(gone).toEqual([]);

    jest.advanceTimersByTime(TAB_PING_INTERVAL_MS);
    await settle();
    expect(gone).toEqual(["ghost"]);

    leader.dispose();
  });

  test("a follower that answers pings stays registered", async () => {
    jest.useFakeTimers();
    const gone: string[] = [];
    const leader = makeCoordinator("tab-a", gone);
    jest.advanceTimersByTime(1);
    await settle();

    const follower = makeCoordinator("tab-b", gone);
    jest.advanceTimersByTime(1);
    await settle();
    expect(follower.role()).toBe("follower");

    follower.postSubscribe({
      key: "clearinghouseState:0x01",
      user: ADDRESS,
      channel: "clearinghouseState",
    });
    await settle();

    for (let index = 0; index < 5; index += 1) {
      jest.advanceTimersByTime(TAB_PING_INTERVAL_MS);
      await settle();
    }

    expect(gone).toEqual([]);

    leader.dispose();
    follower.dispose();
  });

  test("unknown message kinds are ignored", async () => {
    jest.useFakeTimers();
    const gone: string[] = [];
    const leader = makeCoordinator("leader", gone);
    jest.advanceTimersByTime(1);
    await settle();

    const peer = new FakeChannel("0xsignal:user-stream:v1");
    peer.send({ kind: "future-message", tabId: "ghost" });
    await settle();

    expect(leader.role()).toBe("leader");
    jest.advanceTimersByTime(TAB_PING_INTERVAL_MS * (TAB_MISSED_PONG_LIMIT + 1));
    await settle();
    expect(gone).toEqual([]);

    leader.dispose();
  });

  test("dispose detaches the message handler before closing the channel", () => {
    jest.useFakeTimers();
    const channel = new FakeChannel("0xsignal:user-stream:v1");
    const coordinator = createTabCoordinator<TestEvent>({
      createChannel: () => channel,
      tabId: "tab-disposed",
      electionDelayMs: 0,
      isEvent: (value): value is TestEvent =>
        typeof value === "object" && value !== null && "data" in value,
      onPromote: () => {},
      onDemote: () => {},
      onRemoteSubscribe: () => {},
      onRemoteUnsubscribe: () => {},
      onRemoteTabGone: () => {},
      onRemoteData: () => {},
      onLeaderState: () => {},
    });
    expect(channel.listenerCount).toBe(1);

    coordinator.dispose();

    expect(channel.listenerCount).toBe(0);
    // A frame delivered after dispose cannot reach the removed handler.
    channel.deliver({ kind: "leader", tabId: "other" });
    expect(coordinator.role()).toBe("undecided");
  });
});

describe("user stream tab leader election", () => {
  test("a second tab reuses the leader's socket and takes over after it closes", async () => {
    const upstreamA = new CountingUpstream();
    const upstreamB = new CountingUpstream();
    const a = makeClient(upstreamA, "tab-a");
    const b = makeClient(upstreamB, "tab-b");
    const received: ClearinghouseStreamEvent[] = [];

    const first = await a.subscribeClearinghouseState(ADDRESS, () => {});
    expect(upstreamA.clearinghouseSubscribes).toBe(1);

    const second = await b.subscribeClearinghouseState(ADDRESS, (event) => {
      received.push(event);
    });
    await flush();

    expect(upstreamB.clearinghouseSubscribes).toBe(0);

    upstreamA.emit({ data: state("before-handover"), isSnapshot: true });
    await flush();
    expect(received).toHaveLength(1);

    a.dispose();
    await flush();

    expect(upstreamB.clearinghouseSubscribes).toBe(1);

    upstreamB.emit({ data: state("after-handover"), isSnapshot: true });
    expect(received).toHaveLength(2);
    expect(received[1]?.data.marginSummary.accountValue).toBe("after-handover");

    first.unsubscribe();
    second.unsubscribe();
    b.dispose();
  });
});
