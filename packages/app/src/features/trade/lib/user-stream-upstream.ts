import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type {
  SpotStateStreamEvent,
  UpstreamSubscription,
  UserStreamConnectionState,
  UserStreamUpstream,
} from "./user-stream-types";

const USER_STREAM_WS_URL = "wss://api.hyperliquid.xyz/ws";

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

export function createHyperliquidUpstream(): UserStreamUpstream {
  const transport = new WebSocketTransport({ url: USER_STREAM_WS_URL });
  const client = new SubscriptionClient({ transport });
  const socket = transport.socket;

  let state: UserStreamConnectionState = "connecting";
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

  socket.addEventListener("open", () => {
    setState("open");
  });
  socket.addEventListener("close", () => {
    setState("connecting");
    emitError(new Error("Hyperliquid user stream socket closed"));
  });
  socket.addEventListener("error", () => {
    emitError(new Error("Hyperliquid user stream socket error"));
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
    onError: (listener) => {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    dispose: () => {
      stateListeners.clear();
      errorListeners.clear();
      transport.close();
      state = "closed";
    },
  };
}
