import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { Context, Effect, Layer } from "effect";

export class HyperliquidClient extends Context.Tag("HyperliquidClient")<
  HyperliquidClient,
  {
    readonly info: InfoClient;
  }
>() {}

export const HyperliquidClientLive = Layer.effect(
  HyperliquidClient,
  Effect.sync(() =>
    HyperliquidClient.of({
      info: new InfoClient({ transport: new HttpTransport() }),
    })
  )
);
