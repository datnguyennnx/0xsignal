import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../../application/hyperliquid/contracts";

export { HyperliquidClient };

export const hyperliquidClientLayer = Layer.effect(
  HyperliquidClient,
  Effect.sync(() =>
    HyperliquidClient.of({
      info: new InfoClient({ transport: new HttpTransport() }),
    }),
  ),
);
