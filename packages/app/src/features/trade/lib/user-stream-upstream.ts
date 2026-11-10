import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type {
  SpotStateStreamEvent,
  UpstreamSubscription,
  UserStreamConnectionState,
  UserStreamUpstream,
} from "./user-stream-types";

const USER_STREAM_WS_URL = "wss://api.hyperliquid.xyz/ws";

/**
 * A socket that received nothing for this long is presumed half-open: after OS
 * sleep the transport can report OPEN while the peer already forgot the
 * connection, so only a forced reconnect (never a close) revives it.
 */
export const STALE_UPSTREAM_MS = 65_000;

/** A burst of resume events must not thrash the socket. */
export const RECONNECT_COOLDOWN_MS = 5_000;

export interface CreateHyperliquidUpstreamOptions {
  /** Test seam: supply the transport instead of dialing the real endpoint. */
  readonly createTransport?: () => WebSocketTransport;
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

const toSpotBalances = (
  balances: readonly WireSpotBalance[],
): SpotStateStreamEvent["data"]["balances"] =>
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

export function createHyperliquidUpstream(
  options: CreateHyperliquidUpstreamOptions = {},
): UserStreamUpstream {
  const transport =
    options.createTransport?.() ??
    new WebSocketTransport({ url: USER_STREAM_WS_URL, resubscribe: true });
  const client = new SubscriptionClient({ transport });
  const socket = transport.socket;

  let state: UserStreamConnectionState = "connecting";
  let disposed = false;
  // A fresh socket counts as alive; otherwise resume would reconnect it before
  // it ever had a chance to deliver its first snapshot.
  let lastInboundAt = Date.now();
  let lastReconnectAt = Number.NEGATIVE_INFINITY;

  const markInbound = (): void => {
    lastInboundAt = Date.now();
  };

  const stateListeners = new Set<(value: UserStreamConnectionState) => void>();
  const errorListeners = new Set<(error: Error) => void>();
  const setState = (next: UserStreamConnectionState): void => {
    if (state === next) return;
    state = next;
    for (const listener of stateListeners) listener(next);
  };
  const emitError = (error: Error): void => {
    for (const listener of errorListeners) listener(error);
  };
  // A confirmed subscription can die while the socket stays OPEN (a rejected
  // re-subscribe). Without this callback that failure is silent.
  const onSubscriptionError = (error: Error): void => {
    if (disposed) return;
    setState("connecting");
    emitError(new Error(`Hyperliquid user stream subscription failed: ${error.message}`));
  };

  const onSocketOpen = (): void => {
    markInbound();
    setState("open");
  };
  const onSocketClose = (): void => {
    setState("connecting");
    emitError(new Error("Hyperliquid user stream socket closed"));
  };
  const onSocketError = (): void => {
    emitError(new Error("Hyperliquid user stream socket error"));
  };
  const onTermination = (): void => {
    setState("closed");
  };

  socket.addEventListener("open", onSocketOpen);
  socket.addEventListener("close", onSocketClose);
  socket.addEventListener("error", onSocketError);
  socket.terminationSignal.addEventListener("abort", onTermination, { once: true });

  const spotSubscription = (
    user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UpstreamSubscription> =>
    client.spotState(
      { user },
      (event) => {
        markInbound();
        listener({
          data: { ...event.spotState, balances: toSpotBalances(event.spotState.balances) },
          isSnapshot: true,
        });
      },
      { onError: onSubscriptionError },
    );

  return {
    subscribeClearinghouseState: (user, listener) =>
      client.clearinghouseState(
        { user },
        (event) => {
          markInbound();
          listener({ data: event.clearinghouseState, isSnapshot: true });
        },
        { onError: onSubscriptionError },
      ),
    subscribeSpotState: spotSubscription,
    subscribeUserFills: (user, listener) =>
      client.userFills(
        { user },
        (event) => {
          markInbound();
          listener({ data: event.fills, isSnapshot: event.isSnapshot === true });
        },
        { onError: onSubscriptionError },
      ),
    subscribeOpenOrders: (user, listener) =>
      client.openOrders(
        { user },
        (event) => {
          markInbound();
          listener({ data: event.orders, isSnapshot: true });
        },
        { onError: onSubscriptionError },
      ),
    getConnectionState: () => state,
    onConnectionStateChange: (listener) => {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    onError: (listener) => {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    reconnect: () => {
      if (disposed) return;
      const now = Date.now();
      if (now - lastReconnectAt < RECONNECT_COOLDOWN_MS) return;
      lastReconnectAt = now;
      socket.reconnect();
    },
    isStale: (maxAgeMs = STALE_UPSTREAM_MS) => Date.now() - lastInboundAt > maxAgeMs,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      socket.removeEventListener("open", onSocketOpen);
      socket.removeEventListener("close", onSocketClose);
      socket.removeEventListener("error", onSocketError);
      // Added with `{ once: true }`, so removal must not pass a different options object shape.
      socket.terminationSignal.removeEventListener("abort", onTermination);
      stateListeners.clear();
      errorListeners.clear();
      transport.close();
      state = "closed";
    },
  };
}
