import type { ServerWebSocket } from "bun";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data, Effect, Exit, Fiber, Option, Queue, Ref, Scope } from "effect";
import type {
  MarketWsConnectionData,
  MarketWsConnectionSubscription,
  MarketWsSubscription,
} from "../../../modules/market-data";
import { normalizeSymbol } from "../data-sources/symbol";
import { marketWsLog } from "./logging";

export type {
  MarketWsConnectionData,
  MarketWsConnectionSubscription,
  MarketWsSubscription,
} from "../../../modules/market-data";
export { MarketStreamHub, MarketStreamError } from "../../../modules/market-data";

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

export type JoinedBucket = { readonly bucket: Bucket; readonly created: boolean };

/**
 * Adds a connection to its bucket, creating the bucket on the first join.
 * Copy-on-write: an earlier `Ref.get` snapshot must not see this join.
 */
export const joinBucket = (
  buckets: Ref.Ref<Map<string, Bucket>>,
  ws: ServerWebSocket<MarketWsConnectionData>,
  subscription: MarketWsSubscription,
  key: string,
): Effect.Effect<JoinedBucket> =>
  Effect.gen(function* () {
    const candidate: Bucket = {
      key,
      subscription,
      clients: new Set<ServerWebSocket<MarketWsConnectionData>>([ws]),
      upstream: Option.none<ISubscription>(),
      state: { _tag: "idle" },
      retryCount: 0,
      subscribeFiber: Option.none(),
      scope: yield* Scope.make(),
    };

    const joined = yield* Ref.modify(buckets, (m): readonly [JoinedBucket, Map<string, Bucket>] => {
      const existing = m.get(key);
      if (existing !== undefined) {
        const clients = new Set([...existing.clients, ws]);
        const updated: Bucket = { ...existing, clients };
        return [{ bucket: updated, created: false }, new Map(m).set(key, updated)];
      }
      const created = new Map(m).set(key, candidate);
      return [{ bucket: candidate, created: true }, created];
    });

    if (joined.created) {
      marketWsLog("ws_open", {
        connectionId: ws.data.id,
        bucketKey: key,
        channel: subscription.channel,
        clientsInBucket: 1,
      });
    } else {
      yield* Scope.close(candidate.scope, Exit.void);
    }

    return joined;
  });

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

export type DetachRequest = {
  readonly key: string;
  readonly ws: ServerWebSocket<MarketWsConnectionData>;
};

export const unsubscribeQuietly = (subscription: ISubscription): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => subscription.unsubscribe(),
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) =>
      Effect.logWarning(
        `Upstream unsubscribe failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ),
  );

/**
 * Deletes a bucket once its last client has left and releases everything it
 * owns: subscribe fiber, scope, then upstream subscription. A no-op while any
 * client remains, so callers never re-check emptiness themselves.
 */
export const teardownBucket = (
  buckets: Ref.Ref<Map<string, Bucket>>,
  key: string,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const bucket = yield* Ref.modify(buckets, (m) => {
      const current = m.get(key);
      if (current === undefined || current.clients.size > 0) return [undefined, m] as const;
      const next = new Map(m);
      next.delete(key);
      return [current, next] as const;
    });
    if (bucket === undefined) return;

    if (Option.isSome(bucket.subscribeFiber)) {
      yield* Fiber.interrupt(bucket.subscribeFiber.value);
    }
    yield* Scope.close(bucket.scope, Exit.void);
    if (Option.isSome(bucket.upstream)) yield* unsubscribeQuietly(bucket.upstream.value);
  });

/** Drops one client from a bucket and closes it; run by the hub's drain fiber. */
export const applyDetach = (
  buckets: Ref.Ref<Map<string, Bucket>>,
  { key, ws }: DetachRequest,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const removed = yield* Ref.modify(buckets, (m) => removeBucketClient(m, key, ws));
    if (!removed.present) return;
    marketWsLog("ws_client_detached", { bucketKey: key, connectionId: ws.data.id }, "warn");
    closeQuietly(ws, 1013, "client too slow");
    yield* teardownBucket(buckets, key);
  });

/**
 * Detaches a slow client from one bucket. Broadcast runs inside sync SDK
 * callbacks, so it only enqueues; the hub drains the queue in its own fiber.
 * A full queue would strand the socket, so the client is closed inline instead
 * and the next broadcast sees the closed peer.
 */
export const enqueueDetach =
  (requests: Queue.Queue<DetachRequest>, key: string) =>
  (ws: ServerWebSocket<MarketWsConnectionData>): void => {
    if (Queue.offerUnsafe(requests, { key, ws })) return;
    marketWsLog("ws_detach_queue_full", { bucketKey: key, connectionId: ws.data.id }, "warn");
    closeQuietly(ws, 1013, "client too slow");
  };

type BucketState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "subscribing" }
  | { readonly _tag: "restarting" }
  | { readonly _tag: "subscribed"; readonly upstream: ISubscription };
