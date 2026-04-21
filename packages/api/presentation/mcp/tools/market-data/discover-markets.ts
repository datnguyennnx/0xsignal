import { Effect } from "effect";
import { MarketDataServices } from "../../../../application/market-data/contracts";

export const discoverMarketsTool = {
  name: "discover_markets",
  description: "Discover available markets and symbols on Hyperliquid",
  execute: () =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      return yield* services.discoverMarkets();
    }),
  inputSchema: {
    type: "object",
    properties: {},
  },
};
