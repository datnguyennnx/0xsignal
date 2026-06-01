import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { Context, Effect, Layer } from "effect";

export class HyperliquidClient extends Context.Service<
  HyperliquidClient,
  {
    readonly info: InfoClient;
  }
>()("HyperliquidClient") {}

export const hyperliquidClientLayer = Layer.effect(
  HyperliquidClient,
  Effect.sync(() =>
    HyperliquidClient.of({
      info: new InfoClient({ transport: new HttpTransport() }),
    })
  )
);
