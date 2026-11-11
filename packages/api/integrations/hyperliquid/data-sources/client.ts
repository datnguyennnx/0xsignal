import { InfoClient, Transport } from "@0xsignal/sdk-hyperliquid";
import { Effect, Layer } from "effect";
import { HyperliquidClient } from "./hyperliquid-client";

export { HyperliquidClient };

export const hyperliquidClientLayer = Layer.effect(
  HyperliquidClient,
  Effect.sync(() =>
    HyperliquidClient.of({
      info: new InfoClient(new Transport()),
    }),
  ),
);
