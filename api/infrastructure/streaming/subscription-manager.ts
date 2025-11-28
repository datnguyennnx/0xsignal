/**
 * Subscription Manager
 * Callback-based subscription management with lazy loading
 */

import { Effect, Stream, Ref, HashMap, Context, Layer } from "effect";
import type { BinanceKline, Subscription } from "./types";
import { createBinanceConnection } from "./binance-connection";

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
    const pubSub = yield* binanceConnection.subscribeToPubSub();
    const subscriptionsRef = yield* Ref.make<HashMap.HashMap<string, SymbolSubscription>>(
      HashMap.empty()
    );

    // Dispatcher: PubSub -> Callbacks
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

    // Get or create subscription for symbol
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

    // Subscribe client to symbol
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

    // Unsubscribe client from symbol
    const unsubscribe = (symbol: string, clientId: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(subscriptionsRef);
        const subscription = HashMap.get(subscriptions, symbol);

        if (subscription._tag === "None") return;

        subscription.value.callbacks.delete(clientId);

        // Cleanup when last client disconnects
        if (subscription.value.callbacks.size === 0) {
          yield* Effect.logDebug(`[SUB] Cleaning up ${symbol} - no clients`);
          yield* binanceConnection.unsubscribe(symbol, "1m");
          yield* Ref.update(subscriptionsRef, (subs) => HashMap.remove(subs, symbol));
        }
      });

    // Get active subscriptions
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

    // Cleanup all subscriptions
    const cleanup = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(subscriptionsRef);
        for (const [symbol] of HashMap.entries(subscriptions)) {
          yield* binanceConnection.unsubscribe(symbol, "1m");
        }
        yield* Ref.set(subscriptionsRef, HashMap.empty());
      });

    return { subscribe, unsubscribe, getActiveSubscriptions, cleanup };
  })
);
