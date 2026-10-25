import type {
  ClearinghouseState,
  FrontendOpenOrder,
  SpotClearinghouseState,
  UserFill,
} from "@0xsignal/shared";
import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";

/**
 * Browser-direct Hyperliquid user stream.
 *
 * Per-user data goes straight from this tab to Hyperliquid so each end user's
 * IP consumes its own budget. The backend WS hub stays market-only.
 */

const USER_STREAM_WS_URL = "wss://api.hyperliquid.xyz/ws";

/**
 * Documented per-IP limits. The SDK's internal guard allows 15 unique users;
 * the published cap is 10, so the app enforces the stricter number itself.
 */
export const USER_STREAM_LIMITS: {
  readonly uniqueUsers: number;
  readonly connections: number;
  readonly subscriptions: number;
} = {
  uniqueUsers: 10,
  connections: 10,
  subscriptions: 1000,
};

export type UserStreamChannel = "clearinghouseState" | "spotState" | "userFills" | "openOrders";

export type UserStreamConnectionState = "idle" | "connecting" | "open" | "closed";

// Full-state channels carry no snapshot flag on the wire: every message is a
// complete replacement, so they are surfaced as snapshots. userFills is the
// only incremental channel.
export interface ClearinghouseStreamEvent {
  readonly data: ClearinghouseState;
  readonly isSnapshot: true;
}

export interface SpotStateStreamEvent {
  readonly data: SpotClearinghouseState;
  readonly isSnapshot: true;
}

export interface UserFillsStreamEvent {
  readonly data: UserFill[];
  readonly isSnapshot: boolean;
}

export interface OpenOrdersStreamEvent {
  readonly data: FrontendOpenOrder[];
  readonly isSnapshot: true;
}

export interface UserStreamEventMap {
  clearinghouseState: ClearinghouseStreamEvent;
  spotState: SpotStateStreamEvent;
  userFills: UserFillsStreamEvent;
  openOrders: OpenOrdersStreamEvent;
}

export interface UserStreamSubscription {
  unsubscribe(): void;
}

export interface UpstreamSubscription {
  unsubscribe(): Promise<void>;
}

/**
 * The SDK-facing seam. Tests inject a fake so caps, refcounts and snapshot
 * handling are exercised without a socket.
 */
export interface UserStreamUpstream {
  subscribeClearinghouseState(
    user: string,
    listener: (event: ClearinghouseStreamEvent) => void,
  ): Promise<UpstreamSubscription>;
  subscribeSpotState(
    user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UpstreamSubscription>;
  subscribeUserFills(
    user: string,
    listener: (event: UserFillsStreamEvent) => void,
  ): Promise<UpstreamSubscription>;
  subscribeOpenOrders(
    user: string,
    listener: (event: OpenOrdersStreamEvent) => void,
  ): Promise<UpstreamSubscription>;
  getConnectionState(): UserStreamConnectionState;
  onConnectionStateChange(listener: (state: UserStreamConnectionState) => void): () => void;
  dispose(): void;
}

export class UserStreamLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserStreamLimitError";
  }
}

export interface UserStreamClient {
  subscribeClearinghouseState(
    user: string,
    listener: (event: ClearinghouseStreamEvent) => void,
  ): Promise<UserStreamSubscription>;
  subscribeSpotState(
    user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UserStreamSubscription>;
  subscribeUserFills(
    user: string,
    listener: (event: UserFillsStreamEvent) => void,
  ): Promise<UserStreamSubscription>;
  subscribeOpenOrders(
    user: string,
    listener: (event: OpenOrdersStreamEvent) => void,
  ): Promise<UserStreamSubscription>;
  getConnectionState(): UserStreamConnectionState;
  onConnectionStateChange(listener: (state: UserStreamConnectionState) => void): () => void;
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

interface SharedSubscription {
  readonly key: string;
  readonly user: string;
  readonly channel: UserStreamChannel;
  refCount: number;
  readonly holders: Set<ListenerHolder>;
  backing: Promise<UpstreamSubscription> | null;
}

/** Snapshot replaces, update merges newest-first and de-duplicates by fill id. */
export function mergeUserFills(
  current: readonly UserFill[] | undefined,
  event: UserFillsStreamEvent,
): UserFill[] {
  if (event.isSnapshot || current === undefined) return [...event.data];

  const seen = new Set(current.map((fill) => fill.tid));
  const merged = [...event.data.filter((fill) => !seen.has(fill.tid)), ...current];
  merged.sort((a, b) => b.time - a.time);
  return merged;
}

// Outcome-market balances omit `token` on the wire; the shared contract always
// carries one, so the missing id is normalised rather than dropping the balance.
type WireSpotBalance =
  | {
      readonly coin: string;
      readonly token: number;
      readonly total: string;
      readonly hold: string;
      readonly entryNtl: string;
    }
  | {
      readonly coin: string;
      readonly total: string;
      readonly hold: string;
      readonly entryNtl: string;
    };

const toSpotBalances = (balances: readonly WireSpotBalance[]): SpotClearinghouseState["balances"] =>
  balances.map((balance) =>
    "token" in balance
      ? {
          coin: balance.coin,
          token: balance.token,
          total: balance.total,
          hold: balance.hold,
          entryNtl: balance.entryNtl,
        }
      : {
          coin: balance.coin,
          token: 0,
          total: balance.total,
          hold: balance.hold,
          entryNtl: balance.entryNtl,
        },
  );

function createHyperliquidUpstream(): UserStreamUpstream {
  const transport = new WebSocketTransport({ url: USER_STREAM_WS_URL });
  const client = new SubscriptionClient({ transport });
  const socket = transport.socket;

  let state: UserStreamConnectionState = "connecting";
  const stateListeners = new Set<(value: UserStreamConnectionState) => void>();
  const setState = (next: UserStreamConnectionState): void => {
    if (state === next) return;
    state = next;
    for (const listener of stateListeners) listener(next);
  };

  socket.addEventListener("open", () => {
    setState("open");
  });
  socket.addEventListener("close", () => {
    setState("connecting");
  });
  socket.terminationSignal.addEventListener(
    "abort",
    () => {
      setState("closed");
    },
    { once: true },
  );

  const spotSubscription = (
    user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UpstreamSubscription> =>
    client.spotState({ user }, (event) => {
      listener({
        data: { ...event.spotState, balances: toSpotBalances(event.spotState.balances) },
        isSnapshot: true,
      });
    });

  return {
    subscribeClearinghouseState: (user, listener) =>
      client.clearinghouseState({ user }, (event) => {
        listener({ data: event.clearinghouseState, isSnapshot: true });
      }),
    subscribeSpotState: spotSubscription,
    subscribeUserFills: (user, listener) =>
      client.userFills({ user }, (event) => {
        listener({ data: event.fills, isSnapshot: event.isSnapshot === true });
      }),
    subscribeOpenOrders: (user, listener) =>
      client.openOrders({ user }, (event) => {
        listener({ data: event.orders, isSnapshot: true });
      }),
    getConnectionState: () => state,
    onConnectionStateChange: (listener) => {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    dispose: () => {
      stateListeners.clear();
      transport.close();
      state = "closed";
    },
  };
}

export interface UserStreamClientOptions {
  readonly createUpstream?: () => UserStreamUpstream;
}

export function createUserStreamClient(options: UserStreamClientOptions = {}): UserStreamClient {
  const createUpstream = options.createUpstream ?? createHyperliquidUpstream;

  const sharedSubscriptions = new Map<string, SharedSubscription>();
  const activeUsers = new Set<string>();
  const stateListeners = new Set<(value: UserStreamConnectionState) => void>();

  let upstream: UserStreamUpstream | null = null;
  let liveConnections = 0;
  let state: UserStreamConnectionState = "idle";
  let detachUpstreamState: (() => void) | null = null;

  const setState = (next: UserStreamConnectionState): void => {
    if (state === next) return;
    state = next;
    for (const listener of stateListeners) listener(next);
  };

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
    const current = ensureUpstream();
    switch (shared.channel) {
      case "clearinghouseState":
        return current.subscribeClearinghouseState(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "clearinghouseState") holder.listener(event);
          }
        });
      case "spotState":
        return current.subscribeSpotState(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "spotState") holder.listener(event);
          }
        });
      case "userFills":
        return current.subscribeUserFills(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "userFills") holder.listener(event);
          }
        });
      case "openOrders":
        return current.subscribeOpenOrders(shared.user, (event) => {
          for (const holder of shared.holders) {
            if (holder.channel === "openOrders") holder.listener(event);
          }
        });
      default:
        throw new Error(`Unsupported user stream channel: ${String(shared.channel)}`);
    }
  };

  const acquire = async (
    holder: ListenerHolder,
    rawUser: string,
  ): Promise<UserStreamSubscription> => {
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
  };
}

let defaultClient: UserStreamClient | null = null;

function getDefaultClient(): UserStreamClient {
  defaultClient ??= createUserStreamClient();
  return defaultClient;
}

export function subscribeClearinghouseState(
  user: string,
  listener: (event: ClearinghouseStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeClearinghouseState(user, listener);
}

export function subscribeSpotState(
  user: string,
  listener: (event: SpotStateStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeSpotState(user, listener);
}

export function subscribeUserFills(
  user: string,
  listener: (event: UserFillsStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeUserFills(user, listener);
}

export function subscribeOpenOrders(
  user: string,
  listener: (event: OpenOrdersStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeOpenOrders(user, listener);
}

export function getUserStreamConnectionState(): UserStreamConnectionState {
  return getDefaultClient().getConnectionState();
}

export function onUserStreamConnectionStateChange(
  listener: (state: UserStreamConnectionState) => void,
): () => void {
  return getDefaultClient().onConnectionStateChange(listener);
}
