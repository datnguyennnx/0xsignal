import { Clock, Context, Effect, Fiber, Layer, Option, Ref, Schedule } from "effect";
import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import type { MarketWsSubscription } from "./hub-types";
import { marketWsLog } from "./logging";
import { buildMarketWsBucketKey } from "./bucket-key";
import { normalizeSymbol } from "../../data-sources/hyperliquid/symbol";
import { HyperliquidProvider } from "../../data-sources/hyperliquid/types";
import { subscribeUpstream } from "./hub-subscription";
import { send, toText } from "./hub-broadcast";
import {
  type MarketWsConnectionData,
  WebSocketSubscribeError,
  type Bucket,
  type BucketState,
} from "./hub-types";

const MAX_RESTART_RETRIES = 3;

export type { MarketWsConnectionData };
export { WebSocketSubscribeError };

export interface MarketStreamHubPort {
  readonly createConnectionData: (subscription: MarketWsSubscription) => MarketWsConnectionData;
  readonly handleOpen: (ws: ServerWebSocket<MarketWsConnectionData>) => Effect.Effect<void, never>;
  readonly handleClose: (ws: ServerWebSocket<MarketWsConnectionData>) => Effect.Effect<void, never>;
  readonly handleMessage: (
    ws: ServerWebSocket<MarketWsConnectionData>,
    raw: string | Buffer | Uint8Array,
  ) => Effect.Effect<void, never>;
}

export class MarketStreamHub extends Context.Service<MarketStreamHub, MarketStreamHubPort>()(
  "MarketStreamHub",
) {}

export const MarketStreamHubLayer: Layer.Layer<MarketStreamHub, never, HyperliquidProvider> =
  Layer.effect(
    MarketStreamHub,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const provider = yield* HyperliquidProvider;
        const transport = new WebSocketTransport({ resubscribe: true });
        const subscriptionClient = new SubscriptionClient({ transport });
        const buckets: Ref.Ref<Map<string, Bucket>> = yield* Ref.make(new Map<string, Bucket>());

        // Bridge Pattern: connectionSeq counter uses plain number instead of Ref
        // because createConnectionData is a sync function called from non-Effect
        // context (Bun WebSocket upgrade handler). A Ref-based approach would
        // require making the entire interface Effect-based.
        let _connectionSeq = 0;

        const service = MarketStreamHub.of({
          createConnectionData: (subscription) => {
            const nextSeq = ++_connectionSeq;
            const normalized = { ...subscription };
            if (normalized.symbol) {
              normalized.symbol = normalizeSymbol(normalized.symbol);
            }
            return {
              id: String(nextSeq),
              bucketKey: buildMarketWsBucketKey(normalized),
              subscription: normalized,
            };
          },

          handleOpen: (ws) =>
            Effect.gen(function* () {
              const key = ws.data.bucketKey;
              const map = yield* Ref.get(buckets);
              const existing = map.get(key);

              if (existing !== undefined) {
                const bucket = existing;
                // Mutate the existing clients Set in-place so that the upstream
                // subscription callback (which holds a reference to the same
                // bucket object) sees the new client on its next broadcast.
                bucket.clients.add(ws);
                const now = yield* Clock.currentTimeMillis;
                send(ws, {
                  type: "ready",
                  subscription: bucket.subscription,
                  connectionId: ws.data.id,
                  timestamp: now,
                });
                return;
              }

              const bucket: Bucket = {
                key,
                subscription: ws.data.subscription,
                clients: new Set<ServerWebSocket<MarketWsConnectionData>>([ws]),
                upstream: Option.none<ISubscription>(),
                state: { _tag: "idle" },
                retryCount: 0,
                restartFibers: new Set<Fiber.Fiber<void, never>>(),
                firstMarketBroadcastLogged: false,
              };

              yield* Ref.update(buckets, (m) => {
                m.set(key, bucket);
                return m;
              });
              const now = yield* Clock.currentTimeMillis;
              send(ws, {
                type: "ready",
                subscription: bucket.subscription,
                connectionId: ws.data.id,
                timestamp: now,
              });

              marketWsLog("ws_open", {
                connectionId: ws.data.id,
                bucketKey: key,
                channel: bucket.subscription.channel,
                clientsInBucket: 1,
              });

              // Fork upstream subscription in background
              yield* Effect.forkDetach(ensureUpstream(subscriptionClient, provider, buckets, key));
            }),

          handleClose: (ws) =>
            Effect.gen(function* () {
              const key = ws.data.bucketKey;
              const map = yield* Ref.get(buckets);
              const existing = map.get(key);

              if (existing === undefined) return;
              const bucket = existing;

              // Mutate the existing clients Set in-place (mirrors handleOpen).
              bucket.clients.delete(ws);

              if (bucket.clients.size === 0) {
                for (const f of bucket.restartFibers) {
                  yield* Fiber.interrupt(f);
                }

                if (Option.isSome(bucket.upstream)) {
                  const sub = bucket.upstream.value;
                  // SDK v0.33.0: unsubscribe() returns Promise<void>
                  yield* Effect.promise(() => sub.unsubscribe());
                }
                yield* Ref.update(buckets, (m) => {
                  m.delete(key);
                  return m;
                });
              }
            }),

          handleMessage: (ws, raw) =>
            Effect.gen(function* () {
              const payload = toText(raw).trim();
              if (payload === "ping") {
                const now = yield* Clock.currentTimeMillis;
                send(ws, { type: "pong", timestamp: now });
                return;
              }
              if (payload.length > 0) {
                const now = yield* Clock.currentTimeMillis;
                send(ws, {
                  type: "error",
                  code: "unsupported_message",
                  message: "Only ping messages are supported on this endpoint.",
                  timestamp: now,
                });
              }
            }),
        });

        return { buckets, service } as const;
      }),
      ({ buckets }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Shutting down MarketStreamHub");
          const map = yield* Ref.get(buckets);
          for (const bucket of map.values()) {
            for (const f of bucket.restartFibers) {
              yield* Fiber.interrupt(f);
            }
            if (Option.isSome(bucket.upstream)) {
              const sub = bucket.upstream.value;
              yield* Effect.promise(() => sub.unsubscribe());
            }
          }
        }),
    ).pipe(Effect.map(({ service }) => service)),
  );

const resolveAndSubscribe = (
  subscription: MarketWsSubscription,
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  bucket: Bucket,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  onSubscriptionError?: (error: import("@nktkas/hyperliquid").TransportError) => void,
): Effect.Effect<ISubscription, WebSocketSubscribeError> => {
  const subSymbol = subscription.symbol;

  if (!subSymbol) {
    // No symbol means allMids or similar — subscribe directly
    return subscribeUpstream(bucket, subscriptionClient, undefined, detach, onSubscriptionError);
  }

  return Effect.gen(function* () {
    const markets = yield* provider.getAggregatedMarkets().pipe(
      Effect.mapError(
        (err) =>
          new WebSocketSubscribeError({
            message: err.message,
            symbol: subscription.symbol,
          }),
      ),
    );
    return yield* subscribeUpstream(
      bucket,
      subscriptionClient,
      Promise.resolve(markets),
      detach,
      onSubscriptionError,
    );
  });
};

const ensureUpstream = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<Map<string, Bucket>>,
  key: string,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const map = yield* Ref.get(buckets);
    const existing = map.get(key);
    if (existing === undefined) return;
    const bucket = existing;
    if (bucket.state._tag !== "idle") return;

    yield* Ref.update(buckets, (m) => {
      m.set(key, { ...bucket, state: { _tag: "subscribing" } });
      return m;
    });

    const detach = (_ws: ServerWebSocket<MarketWsConnectionData>) => {
      // no-op for now; cleanup happens in handleClose
    };

    // Capture values that may be needed in sync closures
    const subChannel = bucket.subscription.channel;

    const onSubscriptionError = (error: import("@nktkas/hyperliquid").TransportError) => {
      marketWsLog(
        "upstream_subscription_error",
        { bucketKey: key, channel: subChannel, error: error.message },
        "error",
      );
      Effect.runFork(restartBucket(subscriptionClient, provider, buckets, key, error.message));
    };

    yield* resolveAndSubscribe(
      bucket.subscription,
      subscriptionClient,
      provider,
      bucket,
      detach,
      onSubscriptionError,
    ).pipe(
      Effect.retry({
        schedule: Schedule.exponential("500 millis").pipe(Schedule.take(3)),
      }),
      Effect.tap((sub) =>
        Effect.gen(function* () {
          // Read latest bucket from Ref to avoid stale client set
          const currentMap = yield* Ref.get(buckets);
          const currentBucket = currentMap.get(key) ?? bucket;
          yield* Ref.update(buckets, (m) => {
            m.set(key, {
              ...currentBucket,
              upstream: Option.some(sub),
              state: { _tag: "subscribed", upstream: sub } as BucketState,
              retryCount: 0,
            });
            return m;
          });
        }),
      ),
      Effect.catch((error) =>
        Effect.gen(function* () {
          marketWsLog(
            "upstream_subscribe_failed",
            {
              bucketKey: key,
              channel: subChannel,
              error: error.message,
            },
            "error",
          );

          yield* Ref.update(buckets, (m) => {
            const current = m.get(key);
            if (current === undefined) return m;
            m.set(key, { ...current, state: { _tag: "idle" }, retryCount: current.retryCount + 1 });
            return m;
          });

          const updatedMap = yield* Ref.get(buckets);
          const updatedExisting = updatedMap.get(key);

          if (updatedExisting !== undefined && updatedExisting.retryCount < MAX_RESTART_RETRIES) {
            yield* Effect.sleep("1 second");
            yield* ensureUpstream(subscriptionClient, provider, buckets, key);
          } else if (updatedExisting !== undefined) {
            yield* Effect.logError(`Max retries (${MAX_RESTART_RETRIES}) exceeded for ${key}`);
            const now = yield* Clock.currentTimeMillis;
            for (const client of updatedExisting.clients) {
              send(client, {
                type: "error",
                code: "max_retries_exceeded",
                message: `Max retries (${MAX_RESTART_RETRIES}) exceeded for ${key}`,
                timestamp: now,
              });
            }
            yield* Ref.update(buckets, (m) => {
              m.delete(key);
              return m;
            });
          }
        }),
      ),
    );
  });

const restartBucket = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<Map<string, Bucket>>,
  key: string,
  reason: string,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const map = yield* Ref.get(buckets);
    const existing = map.get(key);
    if (existing === undefined) return;
    const bucket = existing;
    if (bucket.state._tag === "idle") return;

    for (const f of bucket.restartFibers) {
      yield* Fiber.interrupt(f);
    }

    if (Option.isSome(bucket.upstream)) {
      const sub = bucket.upstream.value;
      yield* Effect.promise(() => sub.unsubscribe());
    }

    const now = yield* Clock.currentTimeMillis;
    for (const client of bucket.clients) {
      send(client, {
        type: "reconnecting",
        reason,
        timestamp: now,
      });
    }

    yield* Ref.update(buckets, (m) => {
      m.set(key, {
        ...bucket,
        upstream: Option.none(),
        state: { _tag: "idle" },
        restartFibers: new Set(),
      });
      return m;
    });

    const fiber = yield* Effect.forkDetach(
      Effect.sleep("500 millis").pipe(
        Effect.flatMap(() => ensureUpstream(subscriptionClient, provider, buckets, key)),
      ),
    );

    yield* Ref.update(buckets, (m) => {
      const current = m.get(key);
      if (current === undefined) return m;
      m.set(key, { ...current, restartFibers: new Set(current.restartFibers).add(fiber) });
      return m;
    });
  });
