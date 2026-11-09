import { Clock, Effect, Exit, Option, Predicate, Queue, Ref, Schedule, Scope } from "effect";
import type { ISubscription, SubscriptionClient, TransportError } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import {
  type Bucket,
  closeQuietly,
  type MarketWsConnectionData,
  type MarketWsSubscription,
  unsubscribeQuietly,
  WebSocketSubscribeError,
} from "./hub-types";
import { marketWsLog } from "./logging";
import { send } from "./hub-broadcast";
import { subscribeUpstream } from "./hub-subscription";
import type { HyperliquidProvider } from "../data-sources/types";

/** One initial subscribe plus this many retries, so the threshold and the schedule count attempts. */
export const MAX_SUBSCRIBE_ATTEMPTS = 3;

export const subscribeRetrySchedule = Schedule.exponential("500 millis").pipe(
  Schedule.upTo({ times: MAX_SUBSCRIBE_ATTEMPTS - 1 }),
);

const sendQuietly = (ws: ServerWebSocket<MarketWsConnectionData>, payload: unknown): void => {
  try {
    // `send` closes a dropped or backpressured socket instead of leaving it
    // registered; the close handler releases any buckets it still holds.
    send(ws, payload);
  } catch {
    // dead peer — the close handler releases it
  }
};

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

/**
 * Starts the upstream subscription for a bucket. No-op when the bucket is gone
 * or another fiber already claimed it, so a queued restart can never resurrect
 * a closed bucket.
 */
export const ensureUpstream = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<Map<string, Bucket>>,
  key: string,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  restartRequests: Queue.Queue<string>,
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
      // Sync SDK callback: park the restart in the bucket's queue so the drain
      // fiber restarts it, and closing the bucket also stops it.
      Queue.offerUnsafe(restartRequests, error.message);
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
      Effect.retry({ schedule: subscribeRetrySchedule }),
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

          if (failed.retryCount < MAX_SUBSCRIBE_ATTEMPTS) {
            yield* Effect.sleep("1 second");
            yield* ensureUpstream(
              subscriptionClient,
              provider,
              buckets,
              key,
              detach,
              restartRequests,
            );
            return;
          }

          yield* Effect.logError(
            `Max subscribe attempts (${MAX_SUBSCRIBE_ATTEMPTS}) exceeded for ${key}`,
          );
          const now = yield* Clock.currentTimeMillis;
          for (const client of failed.clients) {
            sendQuietly(client, {
              type: "error",
              code: "max_retries_exceeded",
              message: `Max subscribe attempts (${MAX_SUBSCRIBE_ATTEMPTS}) exceeded for ${key}`,
              timestamp: now,
            });
            closeQuietly(client, 1011, "upstream unavailable");
          }
          // Deleting the registry entry is not enough: the bucket owns a scope
          // that holds the subscribe and drain fibers. Capture the exact bucket
          // being removed and close it, or those fibers outlive the bucket.
          const removed = yield* Ref.modify(buckets, (m) => {
            const current = m.get(key);
            if (current === undefined) return [undefined, m] as const;
            const next = new Map(m);
            next.delete(key);
            return [current, next] as const;
          });
          if (removed !== undefined) {
            // Closing from inside the subscribe fiber is safe: a scope skips
            // the closing fiber's own finalizer. Idempotent if already closed.
            yield* Scope.close(removed.scope, Exit.void);
            if (Option.isSome(removed.upstream)) {
              yield* unsubscribeQuietly(removed.upstream.value);
            }
          }
        }),
      ),
    );
  });

export const restartBucket = (
  subscriptionClient: SubscriptionClient,
  provider: typeof HyperliquidProvider.Service,
  buckets: Ref.Ref<Map<string, Bucket>>,
  key: string,
  reason: string,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  restartRequests: Queue.Queue<string>,
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

    yield* ensureUpstream(subscriptionClient, provider, buckets, key, detach, restartRequests);
  });
