import { Context, Effect, Layer } from "effect";
import { HyperliquidMarketStreamHub } from "../../../infrastructure/streams/hyperliquid/hub";
import { HyperliquidProvider } from "../../../infrastructure/data-sources/hyperliquid/types";

export class MarketStreamHub extends Context.Tag("MarketStreamHub")<
  MarketStreamHub,
  HyperliquidMarketStreamHub
>() {}

export const MarketStreamHubLayer = Layer.scoped(
  MarketStreamHub,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const provider = yield* HyperliquidProvider;
      return new HyperliquidMarketStreamHub(provider);
    }),
    (hub) => Effect.sync(() => hub.shutdown())
  )
);
