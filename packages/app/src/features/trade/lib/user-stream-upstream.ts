import { WsClient, cast } from "@0xsignal/sdk-hyperliquid";
import type { ClearinghouseState, OpenOrder, UserFill } from "@0xsignal/shared";
import type {
  SpotStateStreamEvent,
  UpstreamSubscription,
  UserStreamConnectionState,
  UserStreamUpstream,
} from "./user-stream-types";

const USER_STREAM_WS_URL = "wss://api.hyperliquid.xyz/ws";

/**
 * A client that received nothing for this long is presumed half-open: after OS
 * sleep the socket can report OPEN while the peer already forgot the
 * connection, so only a forced reconnect (never a close) revives it.
 */
const STALE_UPSTREAM_MS = 65_000;

/** A burst of resume events must not thrash the socket. */
const RECONNECT_COOLDOWN_MS = 5_000;

type SdkSubscription = Parameters<WsClient["subscribe"]>[0];
type SdkHandle = ReturnType<WsClient["subscribe"]>;

const toUpstream = (handle: SdkHandle): UpstreamSubscription => ({
  unsubscribe: () => handle.unsubscribeAsync(),
});

export interface CreateHyperliquidUpstreamOptions {
  /** Test seam: supply the client instead of dialing the real endpoint. */
  readonly createClient?: () => WsClient;
}

type WireSpotBalance = {
  readonly coin: string;
  readonly token?: number;
  readonly total: string;
  readonly hold: string;
  readonly entryNtl: string;
};

type ClearinghouseEvent = { readonly clearinghouseState: ClearinghouseState };
type WsStatus = "connecting" | "open" | "closed" | "reconnecting";

const toSpotBalances = (
  balances: readonly WireSpotBalance[],
): SpotStateStreamEvent["data"]["balances"] =>
  balances.map((balance) =>
    balance.token === undefined
      ? {
          coin: balance.coin,
          total: balance.total,
          hold: balance.hold,
          entryNtl: balance.entryNtl,
        }
      : {
          coin: balance.coin,
          token: balance.token,
          total: balance.total,
          hold: balance.hold,
          entryNtl: balance.entryNtl,
        },
  );

export function createHyperliquidUpstream(
  options: CreateHyperliquidUpstreamOptions = {},
): UserStreamUpstream {
  const client =
    options.createClient?.() ?? new WsClient({ url: USER_STREAM_WS_URL, shouldReconnect: true });

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
  const onSubscriptionError = (error: unknown): void => {
    if (disposed) return;
    setState("connecting");
    const message = error instanceof Error ? error.message : String(error);
    emitError(new Error(`Hyperliquid user stream subscription failed: ${message}`));
  };

  const onStatus = (status: WsStatus): void => {
    if (status === "open") {
      markInbound();
      setState("open");
      return;
    }
    setState("connecting");
    if (status === "closed") emitError(new Error("Hyperliquid user stream socket closed"));
  };
  const onClientError = (): void => {
    emitError(new Error("Hyperliquid user stream socket error"));
  };
  const onTermination = (): void => {
    setState("closed");
  };

  const detachStatus = client.onStatus(onStatus);
  const detachError = client.onError(onClientError);
  client.terminationSignal.addEventListener("abort", onTermination, { once: true });

  const subscribe = <S extends SdkSubscription>(
    subscription: S,
    onData: Parameters<typeof client.subscribe<S>>[1],
  ): Promise<UpstreamSubscription> =>
    Promise.resolve(
      toUpstream(client.subscribe(subscription, onData, { onError: onSubscriptionError })),
    );

  const spotSubscription = (
    user: string,
    listener: (event: SpotStateStreamEvent) => void,
  ): Promise<UpstreamSubscription> =>
    subscribe({ type: "spotState", user }, (data) => {
      markInbound();
      listener({ data: { balances: toSpotBalances(data.spotState.balances) }, isSnapshot: true });
    });

  return {
    subscribeClearinghouseState: (user, listener) =>
      subscribe({ type: "clearinghouseState", user, dex: "" }, (data) => {
        markInbound();
        listener({
          data: cast<ClearinghouseEvent>(data, "clearinghouseState").clearinghouseState,
          isSnapshot: true,
        });
      }),
    subscribeSpotState: spotSubscription,
    subscribeUserFills: (user, listener) =>
      subscribe({ type: "userFills", user }, (data) => {
        markInbound();
        const fills: UserFill[] = data.fills.map((fill) => ({
          coin: fill.coin,
          side: fill.side,
          dir: fill.dir,
          startPosition: fill.startPosition,
          sz: fill.sz,
          px: fill.px,
          fee: fill.fee,
          hash: fill.hash,
          oid: fill.oid,
          tid: fill.tid,
          time: fill.time,
          closedPnl: fill.closedPnl,
        }));
        listener({ data: fills, isSnapshot: data.isSnapshot === true });
      }),
    subscribeOpenOrders: (user, listener) =>
      subscribe({ type: "openOrders", user, dex: "" }, (data) => {
        markInbound();
        const orders: OpenOrder[] = data.orders.map((order) => ({
          coin: order.coin,
          side: order.side,
          limitPx: order.limitPx,
          sz: order.sz,
          oid: order.oid,
          timestamp: order.timestamp,
          origSz: order.origSz,
          ...(order.cloid !== undefined && { cloid: order.cloid }),
        }));
        listener({ data: orders, isSnapshot: true });
      }),
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
      client.reconnect();
    },
    isStale: (maxAgeMs = STALE_UPSTREAM_MS) => Date.now() - lastInboundAt > maxAgeMs,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      detachStatus();
      detachError();
      client.terminationSignal.removeEventListener("abort", onTermination);
      stateListeners.clear();
      errorListeners.clear();
      client.close();
      state = "closed";
    },
  };
}
