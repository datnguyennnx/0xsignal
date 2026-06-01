import { Context, Effect, Layer } from "effect";
import { HyperliquidMarketStreamHub } from "../../../infrastructure/streams/hyperliquid/hub";
import { HyperliquidProvider } from "../../../infrastructure/data-sources/hyperliquid/types";

export class MarketStreamHub extends Context.Service<MarketStreamHub, HyperliquidMarketStreamHub>()(
  "MarketStreamHub"
) {}

export const MarketStreamHubLayer = Layer.effect(
  MarketStreamHub,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const provider = yield* HyperliquidProvider;
      return new HyperliquidMarketStreamHub(provider);
    }),
    (hub) => Effect.sync(() => hub.shutdown())
  )
);
