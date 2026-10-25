import type {
  ClearinghouseState,
  FrontendOpenOrder,
  SpotClearinghouseState,
  UserFill,
} from "@0xsignal/shared";

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

/**
 * A failure is typed because the three cases need different UI: a rejected
 * subscribe is actionable, a socket close is transient, and auth-less means
 * the browser is not allowed to open the stream at all.
 */
export type UserStreamFailureKind = "subscribe-rejected" | "socket-closed" | "auth-required";

export interface UserStreamFailure {
  readonly kind: UserStreamFailureKind;
  readonly message: string;
}

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

export type UserStreamWireEvent =
  | ClearinghouseStreamEvent
  | SpotStateStreamEvent
  | UserFillsStreamEvent
  | OpenOrdersStreamEvent;

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
  onError?(listener: (error: Error) => void): () => void;
  dispose(): void;
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
  getLastFailure(): UserStreamFailure | null;
  onFailureChange(listener: (failure: UserStreamFailure | null) => void): () => void;
  reportFailure(kind: UserStreamFailureKind, message: string): void;
  dispose(): void;
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
