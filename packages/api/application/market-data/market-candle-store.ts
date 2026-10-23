import { Context, type Effect } from "effect";
import type { Candle } from "@0xsignal/shared";
import type { MarketProviderError } from "./market-provider.error";
import type { CandleQuery } from "./types";

export interface MarketCandleStorePort {
  readonly getCandles: (query: CandleQuery) => Effect.Effect<Candle[], MarketProviderError>;
}

export class MarketCandleStore extends Context.Service<MarketCandleStore, MarketCandleStorePort>()(
  "MarketCandleStore",
) {}
