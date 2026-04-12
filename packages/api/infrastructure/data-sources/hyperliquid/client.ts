import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { Context, Layer } from "effect";

export class HyperliquidClient extends Context.Tag("HyperliquidClient")<
  HyperliquidClient,
  {
    readonly info: InfoClient;
  }
>() {}

export const HyperliquidClientLive = Layer.succeed(
  HyperliquidClient,
  HyperliquidClient.of({
    info: new InfoClient({ transport: new HttpTransport() }),
  })
);
