import type { ServerWebSocket } from "bun";
import type { MarketWsSubscription } from "../../../schemas/market-data/ws";
import type { ISubscription } from "@nktkas/hyperliquid";
import { Data } from "effect";

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
  upstream?: ISubscription;
  subscribing?: Promise<void>; // Promise-based mutex lock for ensureUpstream
  /** Cleanup handle for the old subscription's failureSignal abort listener */
  failureSignalAbortHandler?: () => void;
  restarting: boolean;
  firstMarketBroadcastLogged: boolean;
  retryCount: number;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Extend ServerWebSocket with the runtime backpressure property not exposed in bun types
export interface ServerWebSocketWithBackpressure<T = undefined> extends ServerWebSocket<T> {
  readonly backpressure: number;
}
