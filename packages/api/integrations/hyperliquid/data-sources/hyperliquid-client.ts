import { Context } from "effect";
import type { InfoClient } from "@0xsignal/sdk-hyperliquid";

export class HyperliquidClient extends Context.Service<
  HyperliquidClient,
  {
    readonly info: InfoClient;
  }
>()("HyperliquidClient") {}
