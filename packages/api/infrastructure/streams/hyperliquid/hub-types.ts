import type { ServerWebSocket } from "bun";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data } from "effect";
import type { Fiber, Option } from "effect";

export const MARKET_WS_INTERVALS = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "1w",
] as const;

export type MarketWsInterval = (typeof MARKET_WS_INTERVALS)[number];

export type MarketWsChannel = "candle" | "l2Book" | "trades" | "allMids";

export type MarketWsSubscription = {
  readonly channel: MarketWsChannel;
  readonly symbol?: string;
  readonly interval?: MarketWsInterval;
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
