import type { ServerWebSocket } from "bun";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data, Effect, type Fiber, type Option, Ref, type Scope } from "effect";
import type {
  MarketWsConnectionData,
  MarketWsConnectionSubscription,
  MarketWsSubscription,
} from "../../../application/market-data/market-stream.contracts";
import { normalizeSymbol } from "../../data-sources/hyperliquid/symbol";
import { marketWsLog } from "./logging";

export type {
  MarketWsConnectionData,
  MarketWsConnectionSubscription,
  MarketWsSubscription,
} from "../../../application/market-data/market-stream.contracts";
export {
  MarketStreamHub,
  MarketStreamError,
} from "../../../application/market-data/market-stream.contracts";

export const normalizeMarketWsSubscription = (
  subscription: MarketWsSubscription,
): MarketWsSubscription => {
  if (subscription.symbol === undefined || subscription.symbol === "") {
    return subscription;
  }
  return { ...subscription, symbol: normalizeSymbol(subscription.symbol) };
};

export const addMarketWsConnectionSubscription = (
  subscriptions: Ref.Ref<Map<string, MarketWsConnectionSubscription>>,
  subscription: MarketWsSubscription,
  key: string,
): Effect.Effect<void> =>
  Ref.update(subscriptions, (m) => {
    const existing = m.get(key);
    return new Map(m).set(key, {
      subscription: existing?.subscription ?? subscription,
      bucketKey: key,
      refCount: (existing?.refCount ?? 0) + 1,
    });
  });

/** Returns true when the connection dropped its last reference to the bucket. */
export const removeMarketWsConnectionSubscription = (
  subscriptions: Ref.Ref<Map<string, MarketWsConnectionSubscription>>,
  key: string,
): Effect.Effect<boolean> =>
  Ref.modify(subscriptions, (m) => {
    const existing = m.get(key);
    if (existing === undefined) return [false, m] as const;
    const next = new Map(m);
    if (existing.refCount > 1) {
      next.set(key, { ...existing, refCount: existing.refCount - 1 });
      return [false, next] as const;
    }
    next.delete(key);
    return [true, next] as const;
  });

export class WebSocketSubscribeError extends Data.TaggedError("WebSocketSubscribeError")<{
  readonly message: string;
  readonly symbol?: string | undefined;
}> {}

export type Bucket = {
  readonly key: string;
  readonly subscription: MarketWsSubscription;
  readonly clients: ReadonlySet<ServerWebSocket<MarketWsConnectionData>>;
  readonly upstream: Option.Option<ISubscription>;
  readonly state: BucketState;
  readonly retryCount: number;
  readonly subscribeFiber: Option.Option<Fiber.Fiber<void>>;
  readonly scope: Scope.Closeable;
};

export type ClientRemoval = {
  readonly bucket: Bucket | undefined;
  readonly present: boolean;
};

/** Rebinds a bucket to a clients Set without `ws`; a missing client leaves the map untouched. */
export const removeBucketClient = (
  buckets: Map<string, Bucket>,
  key: string,
  ws: ServerWebSocket<MarketWsConnectionData>,
): readonly [ClientRemoval, Map<string, Bucket>] => {
  const existing = buckets.get(key);
  if (existing === undefined) return [{ bucket: undefined, present: false }, buckets];
  if (!existing.clients.has(ws)) return [{ bucket: existing, present: false }, buckets];
  const clients = new Set(existing.clients);
  clients.delete(ws);
  const bucket: Bucket = { ...existing, clients };
  return [{ bucket, present: true }, new Map(buckets).set(key, bucket)];
};

export const closeQuietly = (
  ws: ServerWebSocket<MarketWsConnectionData>,
  code: number,
  reason: string,
): void => {
  try {
    ws.close(code, reason);
  } catch {
    // the peer already closed the socket
  }
};

/**
 * Detaches a slow client from one bucket. The returned closure captures only
 * the bucket map and key, so it stays valid after the owning fiber is replaced.
 */
export const detachClient =
  (buckets: Ref.Ref<Map<string, Bucket>>, key: string) =>
  (ws: ServerWebSocket<MarketWsConnectionData>): void => {
    const removed = Effect.runSync(Ref.modify(buckets, (m) => removeBucketClient(m, key, ws)));
    if (!removed.present) return;
    marketWsLog("ws_client_detached", { bucketKey: key, connectionId: ws.data.id }, "warn");
    closeQuietly(ws, 1013, "client too slow");
  };

type BucketState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "subscribing" }
  | { readonly _tag: "restarting" }
  | { readonly _tag: "subscribed"; readonly upstream: ISubscription };
