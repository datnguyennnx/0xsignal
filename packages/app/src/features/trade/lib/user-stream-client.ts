// The leader tab streams user data browser-direct; other tabs reuse its socket.
import {
  createTabCoordinator,
  type RemoteSubscriptionRequest,
  type TabChannel,
  type TabCoordinator,
} from "./user-stream-coordination";
import { createHyperliquidUpstream } from "./user-stream-upstream";
import {
  USER_STREAM_LIMITS,
  type ClearinghouseStreamEvent,
  type OpenOrdersStreamEvent,
  type SpotStateStreamEvent,
  type UpstreamSubscription,
  type UserFillsStreamEvent,
  type UserStreamChannel,
  type UserStreamClient,
  type UserStreamConnectionState,
  type UserStreamFailure,
  type UserStreamFailureKind,
  type UserStreamSubscription,
  type UserStreamUpstream,
  type UserStreamWireEvent,
} from "./user-stream-types";

export { mergeUserFills, USER_STREAM_LIMITS } from "./user-stream-types";
export type {
  ClearinghouseStreamEvent,
  OpenOrdersStreamEvent,
  SpotStateStreamEvent,
  UpstreamSubscription,
  UserFillsStreamEvent,
  UserStreamClient,
  UserStreamConnectionState,
  UserStreamFailure,
  UserStreamUpstream,
} from "./user-stream-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWireEvent = (value: unknown): value is UserStreamWireEvent =>
  isRecord(value) && "data" in value;

const isClearinghouseEvent = (event: UserStreamWireEvent): event is ClearinghouseStreamEvent =>
  isRecord(event.data) && "marginSummary" in event.data;

const isSpotStateEvent = (event: UserStreamWireEvent): event is SpotStateStreamEvent =>
  isRecord(event.data) && "balances" in event.data;

const isUserFillsEvent = (event: UserStreamWireEvent): event is UserFillsStreamEvent =>
  Array.isArray(event.data);

const isOpenOrdersEvent = (event: UserStreamWireEvent): event is OpenOrdersStreamEvent =>
  Array.isArray(event.data);

const isUserStreamChannel = (value: string): value is UserStreamChannel =>
  value === "clearinghouseState" ||
  value === "spotState" ||
  value === "userFills" ||
  value === "openOrders";

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

interface ClearinghouseHolder {
  readonly channel: "clearinghouseState";
  readonly listener: (event: ClearinghouseStreamEvent) => void;
}

interface SpotStateHolder {
  readonly channel: "spotState";
  readonly listener: (event: SpotStateStreamEvent) => void;
}

interface UserFillsHolder {
  readonly channel: "userFills";
  readonly listener: (event: UserFillsStreamEvent) => void;
}

interface OpenOrdersHolder {
  readonly channel: "openOrders";
  readonly listener: (event: OpenOrdersStreamEvent) => void;
}

type ListenerHolder = ClearinghouseHolder | SpotStateHolder | UserFillsHolder | OpenOrdersHolder;

const noop = (): void => {};

const remoteHolder = (channel: UserStreamChannel): ListenerHolder => {
  switch (channel) {
    case "clearinghouseState":
      return { channel, listener: noop };
    case "spotState":
      return { channel, listener: noop };
    case "userFills":
      return { channel, listener: noop };
    case "openOrders":
      return { channel, listener: noop };
    default:
      throw new Error(`Unsupported user stream channel: ${String(channel)}`);
  }
};

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
  switch (shared.channel) {
    case "clearinghouseState":
      if (!isClearinghouseEvent(event)) return;
      for (const holder of shared.holders) {
        if (holder.channel === "clearinghouseState") holder.listener(event);
      }
      return;
    case "spotState":
      if (!isSpotStateEvent(event)) return;
      for (const holder of shared.holders) {
        if (holder.channel === "spotState") holder.listener(event);
      }
      return;
    case "userFills":
      if (!isUserFillsEvent(event)) return;
      for (const holder of shared.holders) {
        if (holder.channel === "userFills") holder.listener(event);
      }
      return;
    case "openOrders":
      if (!isOpenOrdersEvent(event)) return;
      for (const holder of shared.holders) {
        if (holder.channel === "openOrders") holder.listener(event);
      }
  }
};

export interface UserStreamClientOptions {
  readonly createUpstream?: () => UserStreamUpstream;
  readonly createBroadcastChannel?: (name: string) => TabChannel;
  readonly tabId?: string;
  readonly electionDelayMs?: number;
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

    switch (shared.channel) {
      case "clearinghouseState":
        return current.subscribeClearinghouseState(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "clearinghouseState") holder.listener(event);
          }
          coordinator?.postData(shared.key, event);
        });
      case "spotState":
        return current.subscribeSpotState(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "spotState") holder.listener(event);
          }
          coordinator?.postData(shared.key, event);
        });
      case "userFills":
        return current.subscribeUserFills(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "userFills") holder.listener(event);
          }
          coordinator?.postData(shared.key, event);
        });
      case "openOrders":
        return current.subscribeOpenOrders(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "openOrders") holder.listener(event);
          }
          coordinator?.postData(shared.key, event);
        });
      default:
        throw new Error(`Unsupported user stream channel: ${String(shared.channel)}`);
    }
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
    const key = `${holder.channel}:${user}`;

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
    dispose: () => {
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
    },
  };
}
