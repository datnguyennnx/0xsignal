import type { ServerWebSocket } from "bun";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data, Effect, type Fiber, type Option, Ref, type Scope } from "effect";
import type {
  MarketWsConnectionData,
  MarketWsConnectionSubscription,
  MarketWsSubscription,
} from "../../../application/market-data/market-stream.contracts";
import { normalizeSymbol } from "../../data-sources/hyperliquid/symbol";

export type {
  MarketWsConnectionData,
  MarketWsConnectionSubscription,
  MarketWsSubscription,
} from "../../../application/market-data/market-stream.contracts";
export { MarketStreamHub } from "../../../application/market-data/market-stream.contracts";

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
    m.set(key, {
      subscription: existing?.subscription ?? subscription,
      bucketKey: key,
      refCount: (existing?.refCount ?? 0) + 1,
    });
    return m;
  });

/** Returns true when the connection dropped its last reference to the bucket. */
export const removeMarketWsConnectionSubscription = (
  subscriptions: Ref.Ref<Map<string, MarketWsConnectionSubscription>>,
  key: string,
): Effect.Effect<boolean> =>
  Ref.modify(subscriptions, (m) => {
    const existing = m.get(key);
    if (existing === undefined) return [false, m] as const;
    if (existing.refCount > 1) {
      m.set(key, { ...existing, refCount: existing.refCount - 1 });
      return [false, m] as const;
    }
    m.delete(key);
    return [true, m] as const;
  });

export class WebSocketSubscribeError extends Data.TaggedError("WebSocketSubscribeError")<{
  readonly message: string;
  readonly symbol?: string | undefined;
}> {}

export type Bucket = {
  readonly key: string;
  readonly subscription: MarketWsSubscription;
  readonly clients: Set<ServerWebSocket<MarketWsConnectionData>>;
  readonly upstream: Option.Option<ISubscription>;
  readonly state: BucketState;
  readonly retryCount: number;
  readonly subscribeFiber: Option.Option<Fiber.Fiber<void>>;
  readonly scope: Scope.Closeable;
};

type BucketState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "subscribing" }
  | { readonly _tag: "restarting" }
  | { readonly _tag: "subscribed"; readonly upstream: ISubscription };
