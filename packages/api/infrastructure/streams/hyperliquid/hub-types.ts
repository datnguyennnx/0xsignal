import type { ServerWebSocket } from "bun";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data, type Fiber, type Option } from "effect";
import { type WsMarketChannel, type WsMarketInterval } from "@0xsignal/shared";

/**
 * Price level in the orderbook.
 */
export interface L2Level {
  readonly px: string;
  readonly sz: string;
  readonly n: number;
}

/**
 * L2 orderbook event from the NKTAS SDK subscription.
 */
export interface L2BookEvent {
  readonly coin: string;
  readonly time: number;
  readonly levels: readonly [readonly L2Level[], readonly L2Level[]];
  readonly spread?: string;
  readonly fast?: true;
}

export type MarketWsSubscription = {
  readonly channel: WsMarketChannel;
  readonly symbol?: string;
  readonly interval?: WsMarketInterval;
  readonly nSigFigs?: 2 | 3 | 4 | 5 | null;
  readonly fast?: boolean;
  readonly depth?: number;
  readonly dex?: string;
};

export type MarketWsConnectionData = {
  readonly id: string;
  readonly bucketKey: string;
  readonly subscription: MarketWsSubscription;
};

export class WebSocketSubscribeError extends Data.TaggedError("WebSocketSubscribeError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

export type Bucket = {
  readonly key: string;
  readonly subscription: MarketWsSubscription;
  readonly clients: Set<ServerWebSocket<MarketWsConnectionData>>;
  readonly upstream: Option.Option<ISubscription>;
  readonly state: BucketState;
  readonly retryCount: number;
  readonly restartFibers: Set<Fiber.Fiber<void, never>>;
  firstMarketBroadcastLogged: boolean;
};

export type BucketState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "subscribing" }
  | { readonly _tag: "subscribed"; readonly upstream: ISubscription };
