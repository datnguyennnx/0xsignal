import { Clock, Effect, Exit, Fiber, Layer, Option, Predicate, Ref, Schedule, Scope } from "effect";
import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription, TransportError } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import {
  addMarketWsConnectionSubscription,
  closeQuietly,
  detachClient,
  MarketStreamHub,
  type MarketWsConnectionData,
  type MarketWsConnectionSubscription,
  type MarketWsSubscription,
  normalizeMarketWsSubscription,
  removeBucketClient,
  removeMarketWsConnectionSubscription,
  WebSocketSubscribeError,
  type Bucket,
} from "./hub-types";
import { marketWsLog } from "./logging";
import { buildMarketWsBucketKey } from "./bucket-key";
import { HyperliquidProvider } from "../data-sources/types";
import { subscribeUpstream } from "./hub-subscription";
import { send, sendFrame, toText } from "./hub-broadcast";
import { parseMarketWsFrame } from "../../../application/market-data/subscription-parser";

const MAX_RESTART_RETRIES = 3;

const unsubscribeQuietly = (subscription: ISubscription): Effect.Effect<void> =>
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

const sendQuietly = (ws: ServerWebSocket<MarketWsConnectionData>, payload: unknown): void => {
  try {
    send(ws, payload);
  } catch {
    // dead peer — broadcast detaches it on the next frame
  }
};

type JoinedBucket = { readonly bucket: Bucket; readonly created: boolean };

type MarketStreamHubClient = {
  readonly subscriptionClient: SubscriptionClient;
  readonly close: () => void;
};

export type MarketStreamHubLayerOptions = {
  readonly createClient?: () => MarketStreamHubClient;
  readonly onAcquire?: (buckets: Ref.Ref<Map<string, Bucket>>) => void;
};

const createDefaultClient = (): MarketStreamHubClient => {
  const transport = new WebSocketTransport({ resubscribe: true });
  return {
    subscriptionClient: new SubscriptionClient({ transport }),
    close: () => {
      transport.close();
    },
  };
};

export const makeMarketStreamHubLayer = (
  provider: typeof HyperliquidProvider.Service,
  options: MarketStreamHubLayerOptions = {},
): Layer.Layer<MarketStreamHub> =>
  Layer.effect(
    MarketStreamHub,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const client = (options.createClient ?? createDefaultClient)();
        const subscriptionClient = client.subscriptionClient;
        const buckets: Ref.Ref<Map<string, Bucket>> = yield* Ref.make(new Map<string, Bucket>());
        options.onAcquire?.(buckets);

        // Bridge Pattern: connectionSeq counter uses plain number instead of Ref
        // because createConnectionData is a sync function called from non-Effect
        // context (Bun WebSocket upgrade handler). A Ref-based approach would
        // require making the entire interface Effect-based.
        let connectionSeq = 0;

        const createConnectionData = (initial?: MarketWsSubscription): MarketWsConnectionData => {
          const subscriptions = new Map<string, MarketWsConnectionSubscription>();

          if (initial !== undefined) {
            const subscription = normalizeMarketWsSubscription(initial);
            const bucketKey = buildMarketWsBucketKey(subscription);
            subscriptions.set(bucketKey, { subscription, bucketKey, refCount: 1 });
          }

          return {
            id: String(++connectionSeq),
            subscriptions: Ref.makeUnsafe(subscriptions),
          };
        };

        const joinBucket = (
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

            // Copy-on-write: an earlier Ref.get snapshot must not see this join.
            const joined = yield* Ref.modify(
              buckets,
              (m): readonly [JoinedBucket, Map<string, Bucket>] => {
                const existing = m.get(key);
                if (existing !== undefined) {
                  const clients = new Set([...existing.clients, ws]);
                  const updated: Bucket = { ...existing, clients };
                  return [{ bucket: updated, created: false }, new Map(m).set(key, updated)];
                }
                const created = new Map(m).set(key, candidate);
                return [{ bucket: candidate, created: true }, created];
              },
            );

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

        const startBucket = (bucket: Bucket): Effect.Effect<void> =>
          Effect.gen(function* () {
            const fiber = yield* Effect.forkIn(
              ensureUpstream(
                subscriptionClient,
                provider,
                buckets,
                bucket.key,
                detachClient(buckets, bucket.key),
              ),
              bucket.scope,
            );

            const registered = yield* Ref.modify(buckets, (m) => {
              const current = m.get(bucket.key);
              if (current === undefined || current.scope !== bucket.scope) {
                return [false, m] as const;
              }
              const subscribed: Bucket = { ...current, subscribeFiber: Option.some(fiber) };
              return [true, new Map(m).set(bucket.key, subscribed)] as const;
            });

            if (!registered) yield* Scope.close(bucket.scope, Exit.void);
          });

        const releaseClient = (
          ws: ServerWebSocket<MarketWsConnectionData>,
          key: string,
        ): Effect.Effect<void> =>
          Effect.gen(function* () {
            const released = yield* Ref.modify(buckets, (m) => removeBucketClient(m, key, ws));
            if (released.bucket === undefined) return;
            const bucket = released.bucket;

            // A slow client may already be detached; still own bucket cleanup.
            if (bucket.clients.size > 0) return;

            // Remove before interrupting so the in-flight subscribe observes
            // an unowned bucket and unsubscribes instead of re-inserting.
            yield* Ref.update(buckets, (m) => {
              const next = new Map(m);
              next.delete(key);
              return next;
            });

            if (Option.isSome(bucket.subscribeFiber)) {
              yield* Fiber.interrupt(bucket.subscribeFiber.value);
            }
            yield* Scope.close(bucket.scope, Exit.void);
            if (Option.isSome(bucket.upstream)) yield* unsubscribeQuietly(bucket.upstream.value);
          });

        const service = MarketStreamHub.of({
          createConnectionData,

          handleOpen: (ws) =>
            Effect.gen(function* () {
              const entries = Array.from((yield* Ref.get(ws.data.subscriptions)).values());

              if (entries.length === 0) {
                const now = yield* Clock.currentTimeMillis;
                yield* sendFrame(ws, { type: "ready", connectionId: ws.data.id, timestamp: now });
                return;
              }

              const [first, ...rest] = entries;
              const joined = yield* joinBucket(ws, first.subscription, first.bucketKey);
              const now = yield* Clock.currentTimeMillis;
              yield* sendFrame(ws, {
                type: "ready",
                subscription: joined.bucket.subscription,
                connectionId: ws.data.id,
                timestamp: now,
              });
              if (joined.created) yield* startBucket(joined.bucket);

              for (const entry of rest) {
                const other = yield* joinBucket(ws, entry.subscription, entry.bucketKey);
                if (other.created) yield* startBucket(other.bucket);
              }
            }),

          handleClose: (ws) =>
            Effect.gen(function* () {
              const subscriptions = yield* Ref.get(ws.data.subscriptions);
              for (const entry of subscriptions.values()) {
                yield* releaseClient(ws, entry.bucketKey);
              }
              yield* Ref.set(ws.data.subscriptions, new Map());
            }),

          handleMessage: (ws, raw) =>
            Effect.gen(function* () {
              const payload = toText(raw).trim();
              if (payload === "ping") {
                const now = yield* Clock.currentTimeMillis;
                yield* sendFrame(ws, { type: "pong", timestamp: now });
                return;
              }
              if (payload.length === 0) return;

              const frame = parseMarketWsFrame(payload);
              if (frame.kind === "unsupported") {
                const now = yield* Clock.currentTimeMillis;
                yield* sendFrame(ws, {
                  type: "error",
                  code: "unsupported_message",
                  message: "Only ping, subscribe, and unsubscribe messages are supported.",
                  timestamp: now,
                });
                return;
              }

              if (frame.kind === "invalid_subscription") {
                const now = yield* Clock.currentTimeMillis;
                yield* sendFrame(ws, {
                  type: "error",
                  code: "invalid_subscription",
                  message: frame.message,
                  timestamp: now,
                });
                return;
              }

              const { subscription } = frame;
              const key = buildMarketWsBucketKey(subscription);

              if (frame.action === "subscribe") {
                yield* addMarketWsConnectionSubscription(ws.data.subscriptions, subscription, key);
                const joined = yield* joinBucket(ws, subscription, key);
                if (joined.created) yield* startBucket(joined.bucket);
                yield* sendFrame(ws, { type: "subscribed", subscription });
                return;
              }

              const released = yield* removeMarketWsConnectionSubscription(
                ws.data.subscriptions,
                key,
              );
              if (released) yield* releaseClient(ws, key);
              yield* sendFrame(ws, { type: "unsubscribed", subscription });
            }),
        });

        return { buckets, service, close: client.close } as const;
      }),
      ({ buckets, close }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("Shutting down MarketStreamHub");
          const map = yield* Ref.get(buckets);
          for (const bucket of map.values()) {
            if (Option.isSome(bucket.subscribeFiber)) {
              yield* Fiber.interrupt(bucket.subscribeFiber.value);
            }
            yield* Scope.close(bucket.scope, Exit.void);
            if (Option.isSome(bucket.upstream)) {
              yield* unsubscribeQuietly(bucket.upstream.value);
            }
          }
          close();
        }),
    ).pipe(Effect.map(({ service }) => service)),
  );

export const MarketStreamHubLayer: Layer.Layer<MarketStreamHub, never, HyperliquidProvider> =
  Layer.unwrap(
    Effect.gen(function* () {
      const provider = yield* HyperliquidProvider;
      return makeMarketStreamHubLayer(provider);
    }),
  );

const resolveAndSubscribe = (
  subscription: MarketWsSubscription,
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  bucket: Bucket,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  resolveBucket: () => Bucket | undefined,
  onSubscriptionError?: (error: TransportError) => void,
): Effect.Effect<ISubscription, WebSocketSubscribeError> => {
  const subSymbol = subscription.symbol;

  if (subSymbol === undefined || subSymbol === "") {
    // No symbol means allMids or similar — subscribe directly
    return subscribeUpstream(
      bucket,
      subscriptionClient,
      undefined,
      detach,
      resolveBucket,
      onSubscriptionError,
    );
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
      resolveBucket,
      onSubscriptionError,
    );
  });
};

const ensureUpstream = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<Map<string, Bucket>>,
  key: string,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const map = yield* Ref.get(buckets);
    const existing = map.get(key);
    if (existing === undefined) return;
    const bucket = existing;

    const claimed = yield* Ref.modify(buckets, (m) => {
      const current = m.get(key);
      if (current === undefined || current.scope !== bucket.scope) return [false, m] as const;
      if (!Predicate.isTagged(current.state, "idle")) return [false, m] as const;
      const subscribing: Bucket = { ...current, state: { _tag: "subscribing" } };
      return [true, new Map(m).set(key, subscribing)] as const;
    });
    if (!claimed) return;

    const subChannel = bucket.subscription.channel;

    const onSubscriptionError = (error: TransportError) => {
      marketWsLog(
        "upstream_subscription_error",
        { bucketKey: key, channel: subChannel, error: error.message },
        "error",
      );
      // Sync SDK callback: park the restart in the bucket scope so closing the
      // bucket (or the layer) also stops it.
      Effect.runFork(
        Effect.forkIn(
          restartBucket(subscriptionClient, provider, buckets, key, error.message, detach),
          bucket.scope,
        ),
      );
    };

    yield* resolveAndSubscribe(
      bucket.subscription,
      subscriptionClient,
      provider,
      bucket,
      detach,
      // Emits resolve the bucket by key: this value is only the claim token.
      () => Ref.getUnsafe(buckets).get(key),
      onSubscriptionError,
    ).pipe(
      Effect.flatMap((sub) =>
        Effect.gen(function* () {
          const currentMap = yield* Ref.get(buckets);
          const current = currentMap.get(key);
          if (
            current === undefined ||
            current.scope !== bucket.scope ||
            !Predicate.isTagged(current.state, "subscribing")
          ) {
            // The bucket was closed or replaced while the subscribe was in
            // flight — never resurrect it, drop the orphaned subscription.
            yield* unsubscribeQuietly(sub);
            return;
          }
          yield* Ref.update(buckets, (m) => {
            const latest = m.get(key);
            if (latest === undefined || latest.scope !== bucket.scope) return m;
            return new Map(m).set(key, {
              ...latest,
              upstream: Option.some(sub),
              state: { _tag: "subscribed", upstream: sub },
              retryCount: 0,
            });
          });
        }),
      ),
      // A close must not land between resolving the subscription and deciding
      // whether the bucket still owns it.
      Effect.uninterruptible,
      Effect.retry({
        schedule: Schedule.exponential("500 millis").pipe(Schedule.upTo({ times: 3 })),
      }),
      Effect.catch((error) =>
        Effect.gen(function* () {
          marketWsLog(
            "upstream_subscribe_failed",
            { bucketKey: key, channel: subChannel, error: error.message },
            "error",
          );

          const failed = yield* Ref.modify(buckets, (m) => {
            const current = m.get(key);
            if (current === undefined || current.scope !== bucket.scope) {
              return [undefined, m] as const;
            }
            if (!Predicate.isTagged(current.state, "subscribing")) return [undefined, m] as const;
            const failedBucket: Bucket = {
              ...current,
              state: { _tag: "idle" },
              retryCount: current.retryCount + 1,
            };
            return [failedBucket, new Map(m).set(key, failedBucket)] as const;
          });
          if (failed === undefined) return;

          if (failed.retryCount < MAX_RESTART_RETRIES) {
            yield* Effect.sleep("1 second");
            yield* ensureUpstream(subscriptionClient, provider, buckets, key, detach);
            return;
          }

          yield* Effect.logError(`Max retries (${MAX_RESTART_RETRIES}) exceeded for ${key}`);
          const now = yield* Clock.currentTimeMillis;
          for (const client of failed.clients) {
            sendQuietly(client, {
              type: "error",
              code: "max_retries_exceeded",
              message: `Max retries (${MAX_RESTART_RETRIES}) exceeded for ${key}`,
              timestamp: now,
            });
            closeQuietly(client, 1011, "upstream unavailable");
          }
          yield* Ref.update(buckets, (m) => {
            const next = new Map(m);
            next.delete(key);
            return next;
          });
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
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const claimed = yield* Ref.modify(buckets, (m) => {
      const current = m.get(key);
      if (current === undefined) return [undefined, m] as const;
      if (Predicate.isTagged(current.state, "idle")) return [undefined, m] as const;
      if (Predicate.isTagged(current.state, "restarting")) return [undefined, m] as const;
      const restarting: Bucket = { ...current, state: { _tag: "restarting" } };
      return [restarting, new Map(m).set(key, restarting)] as const;
    });
    if (claimed === undefined) return;

    if (Option.isSome(claimed.upstream)) {
      yield* unsubscribeQuietly(claimed.upstream.value);
    }

    const now = yield* Clock.currentTimeMillis;
    for (const client of claimed.clients) {
      sendQuietly(client, { type: "reconnecting", reason, timestamp: now });
    }

    yield* Effect.sleep("500 millis");

    const reset = yield* Ref.modify(buckets, (m) => {
      const current = m.get(key);
      if (current === undefined || current.scope !== claimed.scope) return [false, m] as const;
      if (!Predicate.isTagged(current.state, "restarting")) return [false, m] as const;
      const idle: Bucket = { ...current, upstream: Option.none(), state: { _tag: "idle" } };
      return [true, new Map(m).set(key, idle)] as const;
    });
    if (!reset) return;

    yield* ensureUpstream(subscriptionClient, provider, buckets, key, detach);
  });
