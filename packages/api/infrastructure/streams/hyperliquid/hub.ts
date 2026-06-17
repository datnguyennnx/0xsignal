import { Context, Effect, HashMap, Layer, Option, Ref, Schedule } from "effect";
import { Clock, Fiber } from "effect";
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
        const buckets: Ref.Ref<HashMap.HashMap<string, Bucket>> = yield* Ref.make(
          HashMap.empty<string, Bucket>(),
        );

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
              const existing = HashMap.get(map, key);

              if (Option.isSome(existing)) {
                const bucket = existing.value;
                yield* Ref.update(buckets, (m) =>
                  HashMap.set(m, key, {
                    ...bucket,
                    clients: new Set(bucket.clients).add(ws),
                  }),
                );
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

              yield* Ref.update(buckets, (m) => HashMap.set(m, key, bucket));
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
              const existing = HashMap.get(map, key);

              if (Option.isNone(existing)) return;
              const bucket = existing.value;

              const newClients = new Set(bucket.clients);
              newClients.delete(ws);

              if (newClients.size === 0) {
                for (const f of bucket.restartFibers) {
                  yield* Fiber.interrupt(f);
                }

                if (Option.isSome(bucket.upstream)) {
                  const sub = bucket.upstream.value;
                  yield* Effect.sync(() => {
                    sub.unsubscribe();
                  });
                }
                yield* Ref.update(buckets, (m) => HashMap.remove(m, key));
              } else {
                yield* Ref.update(buckets, (m) =>
                  HashMap.set(m, key, { ...bucket, clients: newClients }),
                );
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
          for (const [_, bucket] of map) {
            for (const f of bucket.restartFibers) {
              yield* Fiber.interrupt(f);
            }
            if (Option.isSome(bucket.upstream)) {
              const sub = bucket.upstream.value;
              yield* Effect.sync(() => {
                sub.unsubscribe();
              });
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
): Effect.Effect<ISubscription, WebSocketSubscribeError> => {
  const subSymbol = subscription.symbol;

  if (!subSymbol) {
    // No symbol means allMids or similar — subscribe directly
    return subscribeUpstream(bucket, subscriptionClient, undefined, detach);
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
    return yield* subscribeUpstream(bucket, subscriptionClient, Promise.resolve(markets), detach);
  });
};

const ensureUpstream = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<HashMap.HashMap<string, Bucket>>,
  key: string,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const map = yield* Ref.get(buckets);
    const existing = HashMap.get(map, key);
    if (Option.isNone(existing)) return;
    const bucket = existing.value;
    if (bucket.state._tag !== "idle") return;

    yield* Ref.update(buckets, (m) =>
      HashMap.set(m, key, { ...bucket, state: { _tag: "subscribing" } }),
    );

    const detach = (_ws: ServerWebSocket<MarketWsConnectionData>) => {
      // no-op for now; cleanup happens in handleClose
    };

    // Capture values that may be needed in sync closures
    const subChannel = bucket.subscription.channel;

    yield* resolveAndSubscribe(
      bucket.subscription,
      subscriptionClient,
      provider,
      bucket,
      detach,
    ).pipe(
      Effect.retry({
        schedule: Schedule.exponential("500 millis").pipe(Schedule.take(3)),
      }),
      Effect.tap((sub) =>
        Effect.gen(function* () {
          // Bridge Pattern: sub.failureSignal is a native EventTarget from
          // @nktkas/hyperliquid — not an Effect fiber. We use addEventListener
          // to listen for the native abort signal, then fork a background fiber
          // to handle the restart. This is an acceptable bridge at the adapter
          // boundary between external library and Effect.
          const abortHandler = () => {
            marketWsLog(
              "upstream_failure_signal",
              {
                bucketKey: key,
                channel: subChannel,
              },
              "warn",
            );
            Effect.runFork(
              restartBucket(
                subscriptionClient,
                provider,
                buckets,
                key,
                "upstream_subscription_failed",
              ),
            );
          };
          sub.failureSignal.addEventListener("abort", abortHandler, { once: true });

          yield* Ref.update(buckets, (m) =>
            HashMap.set(m, key, {
              ...bucket,
              upstream: Option.some(sub),
              state: { _tag: "subscribed", upstream: sub } as BucketState,
              retryCount: 0,
            }),
          );
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
            const current = HashMap.get(m, key);
            if (Option.isNone(current)) return m;
            return HashMap.set(m, key, {
              ...current.value,
              state: { _tag: "idle" },
              retryCount: current.value.retryCount + 1,
            });
          });

          const updatedMap = yield* Ref.get(buckets);
          const updatedExisting = HashMap.get(updatedMap, key);

          if (
            Option.isSome(updatedExisting) &&
            updatedExisting.value.retryCount < MAX_RESTART_RETRIES
          ) {
            yield* Effect.sleep("1 second");
            yield* ensureUpstream(subscriptionClient, provider, buckets, key);
          } else if (Option.isSome(updatedExisting)) {
            yield* Effect.logError(`Max retries (${MAX_RESTART_RETRIES}) exceeded for ${key}`);
            const now = yield* Clock.currentTimeMillis;
            for (const client of updatedExisting.value.clients) {
              send(client, {
                type: "error",
                code: "max_retries_exceeded",
                message: `Max retries (${MAX_RESTART_RETRIES}) exceeded for ${key}`,
                timestamp: now,
              });
            }
            yield* Ref.update(buckets, (m) => HashMap.remove(m, key));
          }
        }),
      ),
    );
  });

const restartBucket = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<HashMap.HashMap<string, Bucket>>,
  key: string,
  reason: string,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const map = yield* Ref.get(buckets);
    const existing = HashMap.get(map, key);
    if (Option.isNone(existing)) return;
    const bucket = existing.value;
    if (bucket.state._tag === "idle") return;

    for (const f of bucket.restartFibers) {
      yield* Fiber.interrupt(f);
    }

    if (Option.isSome(bucket.upstream)) {
      const sub = bucket.upstream.value;
      yield* Effect.sync(() => {
        sub.unsubscribe();
      });
    }

    const now = yield* Clock.currentTimeMillis;
    for (const client of bucket.clients) {
      send(client, {
        type: "reconnecting",
        reason,
        timestamp: now,
      });
    }

    yield* Ref.update(buckets, (m) =>
      HashMap.set(m, key, {
        ...bucket,
        upstream: Option.none(),
        state: { _tag: "idle" },
        restartFibers: new Set(),
      }),
    );

    const fiber = yield* Effect.forkDetach(
      Effect.sleep("500 millis").pipe(
        Effect.flatMap(() => ensureUpstream(subscriptionClient, provider, buckets, key)),
      ),
    );

    yield* Ref.update(buckets, (m) => {
      const current = HashMap.get(m, key);
      if (Option.isNone(current)) return m;
      return HashMap.set(m, key, {
        ...current.value,
        restartFibers: new Set(current.value.restartFibers).add(fiber),
      });
    });
  });
