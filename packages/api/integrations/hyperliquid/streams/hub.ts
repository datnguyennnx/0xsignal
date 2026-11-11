import { Clock, Effect, Exit, Fiber, Layer, Option, Queue, Ref, Scope, Stream } from "effect";
import { WsClient } from "@0xsignal/sdk-hyperliquid/subscription";
import type { ServerWebSocket } from "bun";
import {
  addMarketWsConnectionSubscription,
  applyDetach,
  type BucketJoinError,
  detachClientNow,
  enqueueDetach,
  type DetachRequest,
  type JoinedBucket,
  joinBucket,
  MarketStreamHub,
  MAX_CLIENTS_PER_BUCKET,
  type MarketWsConnectionData,
  type MarketWsConnectionSubscription,
  type MarketWsSubscription,
  normalizeMarketWsSubscription,
  removeBucketClient,
  removeMarketWsConnectionSubscription,
  teardownBucket,
  unsubscribeQuietly,
  type Bucket,
} from "./hub-types";
import { buildMarketWsBucketKey } from "./bucket-key";
import { HyperliquidProvider, type HyperliquidAggregatedAsset } from "../data-sources/types";
import type { HyperliquidError } from "../data-sources/errors";
import { sendFrame, toText } from "./hub-broadcast";
import { MarketStreamError, parseMarketWsFrame } from "../../../modules/market-data";
import { ensureUpstream, restartBucket } from "./hub-lifecycle";

export { MAX_BUCKETS, MAX_CLIENTS_PER_BUCKET } from "./hub-types";
export { MAX_SUBSCRIBE_ATTEMPTS, subscribeRetrySchedule } from "./hub-lifecycle";

/**
 * How long the provider's aggregated markets may serve as the symbol/dex
 * allowlist before it is fetched again. A stale-by-a-minute universe is fine:
 * it only affects whether a brand-new listing can subscribe immediately.
 */
const MARKET_ALLOWLIST_TTL_MS = 60_000;

type MarketAllowlist = {
  readonly symbols: ReadonlySet<string>;
  readonly dexes: ReadonlySet<string>;
};

type MarketAllowlistEntry = {
  readonly at: number;
  readonly allowlist: MarketAllowlist;
};

type MarketValidationFailure = {
  readonly code: "unknown_market" | "unknown_dex" | "invalid_subscription";
  readonly message: string;
};

const buildMarketAllowlist = (markets: readonly HyperliquidAggregatedAsset[]): MarketAllowlist => {
  const symbols = new Set<string>();
  const dexes = new Set<string>();
  for (const market of markets) {
    for (const name of [market.rawCoin, market.coin, market.name]) {
      if (name === "") continue;
      symbols.add(name);
      symbols.add(name.toUpperCase());
    }
    const dex = market.dexPrefix;
    if (dex !== null && dex !== "") {
      dexes.add(dex);
      dexes.add(dex.toUpperCase());
    }
  }
  return { symbols, dexes };
};

/** Cached allowlist load; the TTL keeps a per-frame check off the provider. */
const loadMarketAllowlist = (
  provider: typeof HyperliquidProvider.Service,
  cache: Ref.Ref<Option.Option<MarketAllowlistEntry>>,
): Effect.Effect<MarketAllowlist, HyperliquidError> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const cached = yield* Ref.get(cache);
    if (Option.isSome(cached) && now - cached.value.at < MARKET_ALLOWLIST_TTL_MS) {
      return cached.value.allowlist;
    }

    const allowlist = buildMarketAllowlist(yield* provider.getAggregatedMarkets());
    yield* Ref.set(cache, Option.some({ at: now, allowlist }));
    return allowlist;
  });

const validateSubscriptionMarkets = (
  subscription: MarketWsSubscription,
  allowlist: MarketAllowlist,
): MarketValidationFailure | undefined => {
  if (subscription.channel === "allMids") {
    const dex = subscription.dex;
    if (dex === undefined || dex === "") return undefined;
    if (!allowlist.dexes.has(dex) && !allowlist.dexes.has(dex.toUpperCase())) {
      return { code: "unknown_dex", message: `Unknown dex: ${dex}` };
    }
    return undefined;
  }

  const symbol = subscription.symbol;
  if (symbol === undefined || symbol === "") {
    return { code: "invalid_subscription", message: "Missing required field: symbol" };
  }
  if (!allowlist.symbols.has(symbol) && !allowlist.symbols.has(symbol.toUpperCase())) {
    return { code: "unknown_market", message: `Unknown market symbol: ${symbol}` };
  }
  return undefined;
};

/** Applies queued sync-callback work sequentially; the caller owns the scope. */
const drainQueue = <A>(
  requests: Queue.Queue<A>,
  handle: (item: A) => Effect.Effect<void>,
): Effect.Effect<void> => Stream.fromQueue(requests).pipe(Stream.runForEach(handle));

const sendHubError = (
  ws: ServerWebSocket<MarketWsConnectionData>,
  code: string,
  message: string,
): Effect.Effect<void, MarketStreamError> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    yield* sendFrame(ws, { type: "error", code, message, timestamp: now });
  });

/**
 * Joins a bucket and converts a capacity rejection into an error frame. The
 * caller keeps the socket open; existing clients in the bucket are untouched.
 */
const joinOrReport = (
  buckets: Ref.Ref<Map<string, Bucket>>,
  ws: ServerWebSocket<MarketWsConnectionData>,
  subscription: MarketWsSubscription,
  key: string,
): Effect.Effect<Option.Option<JoinedBucket>, MarketStreamError> =>
  joinBucket(buckets, ws, subscription, key).pipe(
    Effect.map(Option.some),
    Effect.catch((error: BucketJoinError) =>
      sendHubError(ws, error.reason, error.message).pipe(Effect.as(Option.none<JoinedBucket>())),
    ),
  );

const sendCachedSnapshot = (
  ws: ServerWebSocket<MarketWsConnectionData>,
  bucket: Bucket,
): Effect.Effect<void, MarketStreamError> =>
  Option.match(bucket.lastSnapshot.current, {
    onNone: () => Effect.void,
    onSome: (frame) => sendFrame(ws, frame),
  });

type MarketStreamHubClient = {
  readonly wsClient: WsClient;
  readonly close: () => void;
};

export type MarketStreamHubLayerOptions = {
  readonly createClient?: () => MarketStreamHubClient;
  readonly onAcquire?: (buckets: Ref.Ref<Map<string, Bucket>>) => void;
};

const createDefaultClient = (): MarketStreamHubClient => {
  const wsClient = new WsClient({ shouldReconnect: true });
  return {
    wsClient,
    close: () => {
      wsClient.close();
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
        const wsClient = client.wsClient;
        const buckets: Ref.Ref<Map<string, Bucket>> = yield* Ref.make(new Map<string, Bucket>());
        const marketAllowlist = yield* Ref.make<Option.Option<MarketAllowlistEntry>>(Option.none());
        options.onAcquire?.(buckets);

        // Broadcast calls detach from sync SDK callbacks; a fiber in the layer
        // scope applies each request instead of the callback starting a runtime.
        // One slot per client a bucket can hold; a burst beyond that rejects
        // the request, and the enqueue side closes that socket and logs.
        const detachRequests = yield* Queue.dropping<DetachRequest>(MAX_CLIENTS_PER_BUCKET);
        yield* Effect.forkScoped(
          drainQueue(detachRequests, (request) => applyDetach(buckets, request)),
        );

        // Overflow lane for a full detach queue. It is unbounded, so a forced
        // release can never be dropped, and it outlives any single connection.
        const forcedDetaches = yield* Queue.unbounded<DetachRequest>();
        yield* Effect.forkScoped(
          drainQueue(forcedDetaches, (request) => applyDetach(buckets, request)),
        );

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

        const startBucket = (bucket: Bucket): Effect.Effect<void> =>
          Effect.gen(function* () {
            const detach = enqueueDetach(detachRequests, bucket.key, (request) => {
              // Queue full: remove the client synchronously so it can never
              // keep the bucket alive, then let the overflow lane tear the
              // bucket down (idempotent if another path removed it first).
              if (detachClientNow(buckets, request)) {
                Queue.offerUnsafe(forcedDetaches, request);
              }
            });
            // The SDK reports subscription failures on a sync callback; the
            // bucket scope owns both the queue and its drain so a closed
            // bucket never restarts and no client's connection scope can shut
            // the queue down while other clients still share the bucket.
            // Coalescing is correct here: only the latest failure matters.
            const restartRequests = yield* Scope.provide(bucket.scope)(
              Effect.acquireRelease(Queue.sliding<string>(1), (queue) =>
                Effect.sync(() => Queue.shutdownUnsafe(queue)),
              ),
            );
            const restart = (reason: string): Effect.Effect<void> =>
              restartBucket(
                wsClient,
                provider,
                buckets,
                bucket.key,
                reason,
                detach,
                restartRequests,
              );
            yield* Effect.forkIn(drainQueue(restartRequests, restart), bucket.scope);

            const fiber = yield* Effect.forkIn(
              ensureUpstream(wsClient, provider, buckets, bucket.key, detach, restartRequests),
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
            yield* Ref.update(buckets, (m) => removeBucketClient(m, key, ws)[1]);
            yield* teardownBucket(buckets, key);
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
              const joined = yield* joinOrReport(buckets, ws, first.subscription, first.bucketKey);
              if (Option.isNone(joined)) return;
              const now = yield* Clock.currentTimeMillis;
              yield* sendFrame(ws, {
                type: "ready",
                subscription: joined.value.bucket.subscription,
                connectionId: ws.data.id,
                timestamp: now,
              });
              yield* sendCachedSnapshot(ws, joined.value.bucket);
              if (joined.value.created) yield* startBucket(joined.value.bucket);

              for (const entry of rest) {
                const other = yield* joinOrReport(buckets, ws, entry.subscription, entry.bucketKey);
                if (Option.isNone(other)) continue;
                yield* sendCachedSnapshot(ws, other.value.bucket);
                if (other.value.created) yield* startBucket(other.value.bucket);
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
                const allowlist = yield* loadMarketAllowlist(provider, marketAllowlist).pipe(
                  Effect.map(Option.some),
                  Effect.catch((error) =>
                    sendHubError(
                      ws,
                      "market_lookup_failed",
                      `Failed to load the market universe: ${error.message}`,
                    ).pipe(Effect.as(Option.none<MarketAllowlist>())),
                  ),
                );
                if (Option.isNone(allowlist)) return;

                const rejection = validateSubscriptionMarkets(subscription, allowlist.value);
                if (rejection !== undefined) {
                  yield* sendHubError(ws, rejection.code, rejection.message);
                  return;
                }

                const joined = yield* joinOrReport(buckets, ws, subscription, key);
                if (Option.isNone(joined)) return;
                yield* addMarketWsConnectionSubscription(ws.data.subscriptions, subscription, key);
                if (joined.value.created) yield* startBucket(joined.value.bucket);
                yield* sendFrame(ws, { type: "subscribed", subscription });
                yield* sendCachedSnapshot(ws, joined.value.bucket);
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
