// ============================================================================
// SUBSCRIPTION MANAGER
// ============================================================================
// Callback-based subscription management with lazy loading
// ============================================================================

import { Effect, Stream, Ref, HashMap, Context, Layer } from "effect";
import type { BinanceKline, Subscription } from "./types";
import { createBinanceConnection } from "./binance-connection";
import { Logger } from "../logging/logger.service";

type KlineCallback = (kline: BinanceKline) => void;

interface SymbolSubscription {
  readonly callbacks: Map<string, KlineCallback>;
  readonly lastAccess: number;
}

export interface SubscriptionManager {
  readonly subscribe: (
    symbol: string,
    clientId: string,
    callback: KlineCallback,
    interval?: string
  ) => Effect.Effect<void>;
  readonly unsubscribe: (symbol: string, clientId: string) => Effect.Effect<void>;
  readonly getActiveSubscriptions: () => Effect.Effect<ReadonlyArray<Subscription>>;
  readonly cleanup: () => Effect.Effect<void>;
}

export class SubscriptionManagerTag extends Context.Tag("SubscriptionManager")<
  SubscriptionManagerTag,
  SubscriptionManager
>() {}

export const SubscriptionManagerLive = Layer.effect(
  SubscriptionManagerTag,
  Effect.gen(function* () {
    const binanceConnection = yield* createBinanceConnection();
    const logger = yield* Logger;
    const pubSub = yield* binanceConnection.subscribeToPubSub();
    const subscriptionsRef = yield* Ref.make<HashMap.HashMap<string, SymbolSubscription>>(
      HashMap.empty()
    );

    // Dispatcher: PubSub → Callbacks
    yield* Effect.forkDaemon(
      Stream.fromPubSub(pubSub).pipe(
        Stream.runForEach((kline) =>
          Effect.gen(function* () {
            const subscriptions = yield* Ref.get(subscriptionsRef);
            const symbolSub = HashMap.get(subscriptions, kline.symbol);

            if (symbolSub._tag === "Some" && symbolSub.value.callbacks.size > 0) {
              for (const [, callback] of symbolSub.value.callbacks.entries()) {
                try {
                  callback(kline);
                } catch {
                  // Ignore callback errors
                }
              }
            }
          })
        ),
        Effect.catchAll(() => Effect.void)
      )
    );

    const getOrCreateSubscription = (
      symbol: string,
      interval: string
    ): Effect.Effect<SymbolSubscription> =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(subscriptionsRef);
        const existing = HashMap.get(subscriptions, symbol);

        if (existing._tag === "Some") {
          return existing.value;
        }

        yield* binanceConnection.subscribe(symbol, interval);

        const subscription: SymbolSubscription = {
          callbacks: new Map(),
          lastAccess: Date.now(),
        };

        yield* Ref.update(subscriptionsRef, (subs) => HashMap.set(subs, symbol, subscription));

        return subscription;
      });

    const subscribe = (
      symbol: string,
      clientId: string,
      callback: KlineCallback,
      interval: string = "1m"
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        const subscription = yield* getOrCreateSubscription(symbol, interval);

        subscription.callbacks.set(clientId, callback);

        yield* Ref.update(subscriptionsRef, (subs) =>
          HashMap.modify(subs, symbol, (sub) => ({
            ...sub,
            callbacks: subscription.callbacks,
            lastAccess: Date.now(),
          }))
        );
      });

    const unsubscribe = (symbol: string, clientId: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(subscriptionsRef);
        const subscription = HashMap.get(subscriptions, symbol);

        if (subscription._tag === "None") {
          return;
        }

        subscription.value.callbacks.delete(clientId);

        // Immediate cleanup when last client disconnects
        if (subscription.value.callbacks.size === 0) {
          yield* logger.info(
            `[CLEANUP] Last client disconnected, unsubscribing from Binance: ${symbol}`
          );
          yield* binanceConnection.unsubscribe(symbol, "1m");
          yield* Ref.update(subscriptionsRef, (subs) => HashMap.remove(subs, symbol));
          yield* logger.info(`[CLEANUP] Cleaned up ${symbol} subscription`);
        }
      });

    const getActiveSubscriptions = (): Effect.Effect<ReadonlyArray<Subscription>> =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(subscriptionsRef);

        return Array.from(HashMap.entries(subscriptions)).map(([symbol, sub]) => ({
          symbol,
          interval: "1m",
          clientCount: sub.callbacks.size,
          lastUpdate: sub.lastAccess,
        }));
      });

    const cleanup = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(subscriptionsRef);

        for (const [symbol] of HashMap.entries(subscriptions)) {
          yield* binanceConnection.unsubscribe(symbol, "1m");
        }

        yield* Ref.set(subscriptionsRef, HashMap.empty());
      });

    return {
      subscribe,
      unsubscribe,
      getActiveSubscriptions,
      cleanup,
    };
  })
);
