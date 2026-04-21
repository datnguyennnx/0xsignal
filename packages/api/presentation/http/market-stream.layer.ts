import { Context, Effect, Layer } from "effect";
import { HyperliquidMarketStreamHub } from "./market-stream";

export class MarketStreamHub extends Context.Tag("MarketStreamHub")<
  MarketStreamHub,
  HyperliquidMarketStreamHub
>() {}

export const MarketStreamHubLayer = Layer.scoped(
  MarketStreamHub,
  Effect.acquireRelease(
    Effect.sync(() => new HyperliquidMarketStreamHub()),
    (hub) => Effect.sync(() => hub.shutdown())
  )
);
