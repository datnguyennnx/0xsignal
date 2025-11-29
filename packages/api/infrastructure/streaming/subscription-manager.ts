/** Subscription Manager - Client subscription handling with functional patterns */

import { Effect, Stream, Ref, HashMap, Context, Layer, Option, pipe, Array as Arr } from "effect";
import type { BinanceKline, Subscription } from "./types";
import { BinanceConnectionTag } from "./binance-connection";

type KlineCallback = (kline: BinanceKline) => void;

// Immutable subscription state
interface SymbolSubscription {
  readonly callbacks: HashMap.HashMap<string, KlineCallback>;
  readonly lastAccess: number;
}

// Service interface
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

// Execute callbacks safely using HashMap
const executeCallbacks = (
  callbacks: HashMap.HashMap<string, KlineCallback>,
  kline: BinanceKline
): void =>
  pipe(
    HashMap.values(callbacks),
    (iter) => Array.from(iter),
    Arr.forEach((callback) => {
      try {
        callback(kline);
      } catch {
        /* ignore callback errors */
      }
    })
  );

// Transform HashMap to Subscription array
const toSubscriptionArray = (
  subs: HashMap.HashMap<string, SymbolSubscription>
): ReadonlyArray<Subscription> =>
  pipe(
    Array.from(HashMap.entries(subs)),
    Arr.map(([symbol, sub]) => ({
      symbol,
      interval: "1m",
      clientCount: HashMap.size(sub.callbacks),
      lastUpdate: sub.lastAccess,
    }))
  );

// Service implementation
export const SubscriptionManagerLive = Layer.effect(
  SubscriptionManagerTag,
  Effect.gen(function* () {
    const binance = yield* BinanceConnectionTag;
    const subscriptionsRef = yield* Ref.make<HashMap.HashMap<string, SymbolSubscription>>(
      HashMap.empty()
    );

    // Dispatcher: PubSub -> Callbacks using functional approach
    yield* Effect.forkDaemon(
      Stream.fromPubSub(binance.pubSub).pipe(
        Stream.runForEach((kline) =>
          Effect.gen(function* () {
            const subs = yield* Ref.get(subscriptionsRef);
            pipe(
              HashMap.get(subs, kline.symbol),
              Option.map((sub) => executeCallbacks(sub.callbacks, kline))
            );
          })
        ),
        Effect.catchAll(() => Effect.void)
      )
    );

    return {
      subscribe: (symbol: string, clientId: string, callback: KlineCallback, interval = "1m") =>
        Effect.gen(function* () {
          const subs = yield* Ref.get(subscriptionsRef);
          const existing = HashMap.get(subs, symbol);

          // Subscribe to binance if new symbol
          yield* pipe(
            existing,
            Option.match({
              onNone: () => binance.subscribe(symbol, interval),
              onSome: () => Effect.void,
            })
          );

          // Create or update subscription immutably
          const sub: SymbolSubscription = pipe(
            existing,
            Option.map((e) => ({
              callbacks: HashMap.set(e.callbacks, clientId, callback),
              lastAccess: Date.now(),
            })),
            Option.getOrElse(() => ({
              callbacks: HashMap.make([clientId, callback]),
              lastAccess: Date.now(),
            }))
          );

          yield* Ref.update(subscriptionsRef, HashMap.set(symbol, sub));
        }),

      unsubscribe: (symbol: string, clientId: string) =>
        Effect.gen(function* () {
          const subs = yield* Ref.get(subscriptionsRef);

          yield* pipe(
            HashMap.get(subs, symbol),
            Option.match({
              onNone: () => Effect.void,
              onSome: (sub) =>
                Effect.gen(function* () {
                  const updated = HashMap.remove(sub.callbacks, clientId);

                  yield* HashMap.size(updated) === 0
                    ? Effect.gen(function* () {
                        yield* binance.unsubscribe(symbol);
                        yield* Ref.update(subscriptionsRef, HashMap.remove(symbol));
                      })
                    : Ref.update(
                        subscriptionsRef,
                        HashMap.set(symbol, { ...sub, callbacks: updated })
                      );
                }),
            })
          );
        }),

      getActiveSubscriptions: () => Ref.get(subscriptionsRef).pipe(Effect.map(toSubscriptionArray)),

      cleanup: () =>
        Effect.gen(function* () {
          const subs = yield* Ref.get(subscriptionsRef);
          yield* Effect.forEach(
            Array.from(HashMap.keys(subs)),
            (symbol) => binance.unsubscribe(symbol),
            { concurrency: "unbounded" }
          );
          yield* Ref.set(subscriptionsRef, HashMap.empty());
        }),
    };
  })
);
