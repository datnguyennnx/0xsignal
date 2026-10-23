import { Context } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";

export class HyperliquidClient extends Context.Service<
  HyperliquidClient,
  {
    readonly info: InfoClient;
  }
>()("HyperliquidClient") {}
