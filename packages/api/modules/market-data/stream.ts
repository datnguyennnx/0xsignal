import type { ServerWebSocket } from "bun";
import { Context, Data, type Effect, type Ref } from "effect";
import type { WsMarketChannel, WsMarketInterval } from "@0xsignal/shared";

/** A WS port call failed after the connection was accepted. */
export class MarketStreamError extends Data.TaggedError("MarketStreamError")<{
  readonly message: string;
  readonly code: "SEND_FAILED";
  readonly cause?: unknown;
}> {}

type MarketWsChannel = Exclude<WsMarketChannel, "trades">;

export type MarketWsSubscription = {
  readonly channel: MarketWsChannel;
  readonly symbol?: string | undefined;
  readonly interval?: WsMarketInterval | undefined;
  readonly nSigFigs?: 2 | 3 | 4 | 5 | null | undefined;
  readonly fast?: boolean | undefined;
  readonly depth?: number | undefined;
  readonly dex?: string | undefined;
};

/** A subscription held by one connection; `refCount` counts duplicate frames. */
export type MarketWsConnectionSubscription = {
  readonly subscription: MarketWsSubscription;
  readonly bucketKey: string;
  readonly refCount: number;
};

export type MarketWsConnectionData = {
  readonly id: string;
  /** Keyed by bucket key so duplicate subscribe frames share one upstream slot. */
  readonly subscriptions: Ref.Ref<Map<string, MarketWsConnectionSubscription>>;
};

export interface MarketStreamHubPort {
  readonly createConnectionData: (initial?: MarketWsSubscription) => MarketWsConnectionData;
  readonly handleOpen: (
    ws: ServerWebSocket<MarketWsConnectionData>,
  ) => Effect.Effect<void, MarketStreamError>;
  readonly handleClose: (
    ws: ServerWebSocket<MarketWsConnectionData>,
  ) => Effect.Effect<void, MarketStreamError>;
  readonly handleMessage: (
    ws: ServerWebSocket<MarketWsConnectionData>,
    raw: string | Buffer | Uint8Array,
  ) => Effect.Effect<void, MarketStreamError>;
}

export class MarketStreamHub extends Context.Service<MarketStreamHub, MarketStreamHubPort>()(
  "MarketStreamHub",
) {}
