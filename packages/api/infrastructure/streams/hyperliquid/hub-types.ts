import type { ServerWebSocket } from "bun";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data } from "effect";
import type { Fiber, Option } from "effect";
import { type WsMarketChannel, type WsMarketInterval } from "@0xsignal/shared";

export type MarketWsSubscription = {
  readonly channel: WsMarketChannel;
  readonly symbol?: string;
  readonly interval?: WsMarketInterval;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Extend ServerWebSocket with the runtime backpressure property not exposed in bun types
export interface ServerWebSocketWithBackpressure<T = undefined> extends ServerWebSocket<T> {
  readonly backpressure: number;
}
