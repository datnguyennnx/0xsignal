/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { ClearinghouseState } from "@0xsignal/shared";
import type {
  ClearinghouseStreamEvent,
  UserStreamConnectionState,
  UserStreamUpstream,
} from "./user-stream-types";
import { createUserStreamClient } from "./user-stream-client";
import type { TabChannel } from "./user-stream-coordination";

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
