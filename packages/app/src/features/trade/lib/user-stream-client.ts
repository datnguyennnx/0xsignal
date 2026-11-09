// The leader tab streams user data browser-direct; other tabs reuse its socket.
import { onPageResume } from "@/lib/page-visibility";
import {
  createTabCoordinator,
  type RemoteSubscriptionRequest,
  type TabChannel,
  type TabCoordinator,
} from "./user-stream-coordination";
import { createHyperliquidUpstream } from "./user-stream-upstream";
import { SubscriptionKey } from "./stream-identity";
import {
  USER_STREAM_CHANNEL_TABLE,
  USER_STREAM_LIMITS,
  type ListenerHolder,
  type UpstreamSubscription,
  type UserStreamChannel,
  type UserStreamClient,
  type UserStreamConnectionState,
  type UserStreamFailure,
  type UserStreamFailureKind,
  type UserStreamSubscription,
  type UserStreamUpstream,
  type UserStreamWireEvent,
} from "./user-stream-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWireEvent = (value: unknown): value is UserStreamWireEvent =>
  isRecord(value) && "data" in value;

const isUserStreamChannel = (value: string): value is UserStreamChannel =>
  Object.hasOwn(USER_STREAM_CHANNEL_TABLE, value);

const isUserStreamConnectionState = (value: string): value is UserStreamConnectionState =>
  value === "idle" || value === "connecting" || value === "open" || value === "closed";

export class UserStreamLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserStreamLimitError";
  }
}

class UserStreamAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserStreamAuthError";
  }
}

const remoteHolder = (channel: UserStreamChannel): ListenerHolder =>
  USER_STREAM_CHANNEL_TABLE[channel].holder();

interface SharedSubscription {
  readonly key: string;
  readonly user: string;
  readonly channel: UserStreamChannel;
  refCount: number;
  readonly holders: Set<ListenerHolder>;
  backing: Promise<UpstreamSubscription> | null;
  /** Which tab owns the upstream socket for this subscription. */
  backingMode: "upstream" | "broadcast";
}

const deliverToShared = (shared: SharedSubscription, event: UserStreamWireEvent): void => {
  const spec = USER_STREAM_CHANNEL_TABLE[shared.channel];
  if (!spec.guard(event)) return;
  spec.deliver(shared.holders, event);
};

export interface UserStreamClientOptions {
  readonly createUpstream?: () => UserStreamUpstream;
  readonly createBroadcastChannel?: (name: string) => TabChannel;
  readonly tabId?: string;
  readonly electionDelayMs?: number;
  /** Test seam: defaults to the real `onPageResume`. */
  readonly subscribePageResume?: (listener: () => void) => () => void;
}

const hasBroadcastChannel = (): boolean => typeof BroadcastChannel !== "undefined";

const createBroadcastTabChannel = (name: string): TabChannel => {
  const channel = new BroadcastChannel(name);
  const send = channel.postMessage.bind(channel);
  return {
    send: (message) => {
      send(message);
    },
    close: () => {
      channel.close();
    },
    addEventListener: (type, listener) => {
      channel.addEventListener(type, (event) => {
        listener(event);
      });
    },
  };
};

export function createUserStreamClient(options: UserStreamClientOptions = {}): UserStreamClient {
  const createUpstream = options.createUpstream ?? createHyperliquidUpstream;
  const subscribePageResume = options.subscribePageResume ?? onPageResume;
  // An injected upstream marks an isolated client (tests, non-browser hosts);
  // only the real client joins the cross-tab election.
  const createChannel =
    options.createBroadcastChannel ??
    (options.createUpstream === undefined && hasBroadcastChannel()
      ? createBroadcastTabChannel
      : null);

  const sharedSubscriptions = new Map<string, SharedSubscription>();
  const activeUsers = new Set<string>();
  const stateListeners = new Set<(value: UserStreamConnectionState) => void>();
  const failureListeners = new Set<(failure: UserStreamFailure | null) => void>();
  const remoteSubscriptions = new Map<
    string,
    { readonly handle: UserStreamSubscription; readonly tabs: Set<string> }
  >();

  let upstream: UserStreamUpstream | null = null;
  let liveConnections = 0;
  let state: UserStreamConnectionState = "idle";
  let detachUpstreamState: (() => void) | null = null;
  let detachUpstreamError: (() => void) | null = null;
  let detachPageResume: (() => void) | null = null;
  let lastFailure: UserStreamFailure | null = null;

  const setState = (next: UserStreamConnectionState): void => {
    if (state === next) return;
    state = next;
    for (const listener of stateListeners) listener(next);
    if (next === "open") clearFailure();
    if (coordinator !== null && coordinator.role() === "leader") {
      coordinator.postLeaderState(next);
    }
  };

  const clearFailure = (): void => {
    if (lastFailure === null) return;
    lastFailure = null;
    for (const listener of failureListeners) listener(null);
  };

  const reportFailure = (kind: UserStreamFailureKind, message: string): void => {
    if (lastFailure?.kind === kind && lastFailure.message === message) return;
    lastFailure = { kind, message };
    for (const listener of failureListeners) listener(lastFailure);
  };

  const deliver = (key: string, event: UserStreamWireEvent): void => {
    const shared = sharedSubscriptions.get(key);
    if (shared !== undefined) deliverToShared(shared, event);
  };

  const coordinator: TabCoordinator<UserStreamWireEvent> | null =
    createChannel === null
      ? null
      : createTabCoordinator<UserStreamWireEvent>({
          createChannel,
          tabId: options.tabId ?? crypto.randomUUID(),
          electionDelayMs: options.electionDelayMs ?? 250,
          isEvent: isWireEvent,
          onPromote: () => {
            rehomeAll("upstream");
          },
          onDemote: () => {
            rehomeAll("broadcast");
          },
          onRemoteSubscribe: (request, tabId) => {
            void addRemote(request, tabId);
          },
          onRemoteUnsubscribe: (request, tabId) => {
            removeRemote(request.key, tabId);
          },
          onRemoteTabGone: (tabId) => {
            for (const key of remoteSubscriptions.keys()) removeRemote(key, tabId);
          },
          onRemoteData: (key, event) => {
            deliver(key, event);
          },
          onLeaderState: (next) => {
            if (isUserStreamConnectionState(next)) setState(next);
          },
        });

  const ensureUpstream = (): UserStreamUpstream => {
    if (upstream !== null) return upstream;
    if (liveConnections >= USER_STREAM_LIMITS.connections) {
      throw new UserStreamLimitError(
        `Refusing a new user stream: ${USER_STREAM_LIMITS.connections} connections already open (Hyperliquid per-IP limit).`,
      );
    }
    const next = createUpstream();
    upstream = next;
    liveConnections += 1;
    detachUpstreamState = next.onConnectionStateChange(setState);
    detachUpstreamError =
      next.onError?.((error) => {
        reportFailure("socket-closed", error.message);
      }) ?? null;
    // OS sleep can leave the socket half-open while it still reports OPEN, so a
    // resume only forces a reconnect when nothing arrived for a while.
    detachPageResume = subscribePageResume(() => {
      if (!next.isStale()) return;
      next.reconnect();
    });
    setState(next.getConnectionState());
    return next;
  };

  const disposeUpstream = (): void => {
    if (upstream === null) return;
    const current = upstream;
    upstream = null;
    liveConnections -= 1;
    detachUpstreamState?.();
    detachUpstreamState = null;
    detachUpstreamError?.();
    detachUpstreamError = null;
    detachPageResume?.();
    detachPageResume = null;
    current.dispose();
    setState("idle");
  };

  const removeUserIfUnused = (user: string): void => {
    for (const shared of sharedSubscriptions.values()) {
      if (shared.user === user) return;
    }
    activeUsers.delete(user);
  };

  const release = (shared: SharedSubscription, holder: ListenerHolder): void => {
    shared.holders.delete(holder);
    shared.refCount -= 1;
    if (shared.refCount > 0) return;

    sharedSubscriptions.delete(shared.key);
    removeUserIfUnused(shared.user);

    const backing = shared.backing;
    shared.backing = null;
    if (backing !== null) {
      void backing.then((subscription) => subscription.unsubscribe()).catch(() => null);
    }

    if (sharedSubscriptions.size === 0) disposeUpstream();
  };

  const makeHandle = (
    shared: SharedSubscription,
    holder: ListenerHolder,
  ): UserStreamSubscription => {
    let released = false;
    return {
      unsubscribe: () => {
        if (released) return;
        released = true;
        release(shared, holder);
      },
    };
  };

  const startBacking = (shared: SharedSubscription): Promise<UpstreamSubscription> => {
    if (coordinator !== null && coordinator.role() !== "leader") {
      shared.backingMode = "broadcast";
      coordinator.postSubscribe({
        key: shared.key,
        user: shared.user,
        channel: shared.channel,
      });
      return Promise.resolve({
        unsubscribe: () => {
          coordinator?.postUnsubscribe({
            key: shared.key,
            user: shared.user,
            channel: shared.channel,
          });
          return Promise.resolve();
        },
      });
    }

    shared.backingMode = "upstream";
    const current = ensureUpstream();

    return USER_STREAM_CHANNEL_TABLE[shared.channel].subscribe(current, shared.user, (event) => {
      deliverToShared(shared, event);
      coordinator?.postData(shared.key, event);
    });
  };

  /** Swaps every local subscription between the owned socket and the leader. */
  const rehomeAll = (target: "upstream" | "broadcast"): void => {
    for (const shared of sharedSubscriptions.values()) {
      if (shared.backingMode === target) continue;
      const previous = shared.backing;
      shared.backing = null;
      if (previous !== null) {
        void previous.then((subscription) => subscription.unsubscribe()).catch(() => null);
      }
      try {
        const next = startBacking(shared);
        shared.backing = next;
        void next.catch((error: unknown) => {
          reportFailure(
            "subscribe-rejected",
            error instanceof Error ? error.message : String(error),
          );
        });
      } catch (error) {
        reportFailure("subscribe-rejected", error instanceof Error ? error.message : String(error));
      }
    }
  };

  const addRemote = async (request: RemoteSubscriptionRequest, tabId: string): Promise<void> => {
    const existing = remoteSubscriptions.get(request.key);
    if (existing !== undefined) {
      existing.tabs.add(tabId);
      return;
    }
    if (!isUserStreamChannel(request.channel)) return;
    try {
      const handle = await acquire(remoteHolder(request.channel), request.user);
      // Another add for the same key may have finished while we awaited. Only
      // one handle may be stored; release the duplicate so its refcount drops.
      const current = remoteSubscriptions.get(request.key);
      if (current !== undefined) {
        current.tabs.add(tabId);
        handle.unsubscribe();
        return;
      }
      remoteSubscriptions.set(request.key, { handle, tabs: new Set([tabId]) });
    } catch (error) {
      reportFailure("subscribe-rejected", error instanceof Error ? error.message : String(error));
    }
  };

  const removeRemote = (key: string, tabId: string): void => {
    const entry = remoteSubscriptions.get(key);
    if (entry === undefined) return;
    entry.tabs.delete(tabId);
    if (entry.tabs.size > 0) return;
    remoteSubscriptions.delete(key);
    entry.handle.unsubscribe();
  };

  const acquire = async (
    holder: ListenerHolder,
    rawUser: string,
  ): Promise<UserStreamSubscription> => {
    if (rawUser.trim() === "") {
      reportFailure("auth-required", "A wallet address is required for the user stream");
      throw new UserStreamAuthError("A wallet address is required for the user stream");
    }
    if (coordinator !== null) await coordinator.whenReady();

    const user = rawUser.toLowerCase();
    const key = SubscriptionKey.user(holder.channel, user);

    const existing = sharedSubscriptions.get(key);
    if (existing !== undefined) {
      existing.refCount += 1;
      existing.holders.add(holder);
      return makeHandle(existing, holder);
    }

    if (!activeUsers.has(user) && activeUsers.size >= USER_STREAM_LIMITS.uniqueUsers) {
      throw new UserStreamLimitError(
        `Refusing ${user}: this browser already streams ${USER_STREAM_LIMITS.uniqueUsers} unique users, the Hyperliquid per-IP limit.`,
      );
    }
    if (sharedSubscriptions.size >= USER_STREAM_LIMITS.subscriptions) {
      throw new UserStreamLimitError(
        `Refusing ${key}: ${USER_STREAM_LIMITS.subscriptions} subscriptions are already active, the Hyperliquid per-IP limit.`,
      );
    }

    const shared: SharedSubscription = {
      key,
      user,
      channel: holder.channel,
      refCount: 1,
      holders: new Set([holder]),
      backing: null,
      backingMode: "upstream",
    };
    sharedSubscriptions.set(key, shared);
    activeUsers.add(user);

    try {
      const backing = startBacking(shared);
      shared.backing = backing;
      await backing;
    } catch (error) {
      sharedSubscriptions.delete(key);
      removeUserIfUnused(user);
      if (sharedSubscriptions.size === 0) disposeUpstream();
      reportFailure("subscribe-rejected", error instanceof Error ? error.message : String(error));
      throw error;
    }

    return makeHandle(shared, holder);
  };

  let disposed = false;
  let pagehideAttached = false;

  function detachPagehide(): void {
    if (!pagehideAttached) return;
    pagehideAttached = false;
    window.removeEventListener("pagehide", onPagehide);
  }

  function teardown(): void {
    if (disposed) return;
    disposed = true;
    detachPagehide();
    coordinator?.dispose();
    for (const entry of remoteSubscriptions.values()) entry.handle.unsubscribe();
    remoteSubscriptions.clear();
    for (const shared of sharedSubscriptions.values()) {
      const backing = shared.backing;
      shared.backing = null;
      if (backing !== null) {
        void backing.then((subscription) => subscription.unsubscribe()).catch(() => null);
      }
    }
    sharedSubscriptions.clear();
    activeUsers.clear();
    disposeUpstream();
    stateListeners.clear();
    failureListeners.clear();
  }

  function onPagehide(): void {
    teardown();
  }

  // A normally closed tab must say goodbye before it freezes or unloads, or the
  // leader keeps its remote subscriptions alive forever. Guarded so SSR and
  // workers without a window never touch DOM globals.
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", onPagehide);
    pagehideAttached = true;
  }

  return {
    subscribeClearinghouseState: (user, listener) =>
      acquire({ channel: "clearinghouseState", listener }, user),
    subscribeSpotState: (user, listener) => acquire({ channel: "spotState", listener }, user),
    subscribeUserFills: (user, listener) => acquire({ channel: "userFills", listener }, user),
    subscribeOpenOrders: (user, listener) => acquire({ channel: "openOrders", listener }, user),
    getConnectionState: () => state,
    onConnectionStateChange: (listener) => {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    getLastFailure: () => lastFailure,
    onFailureChange: (listener) => {
      failureListeners.add(listener);
      return () => {
        failureListeners.delete(listener);
      };
    },
    reportFailure,
    dispose: teardown,
  };
}
