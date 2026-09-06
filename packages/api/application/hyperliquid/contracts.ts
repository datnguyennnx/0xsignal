import { Context } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";

export type HyperliquidLegalCheck = Awaited<ReturnType<InfoClient["legalCheck"]>>;
export type HyperliquidUserFees = Awaited<ReturnType<InfoClient["userFees"]>>;
export type HyperliquidTwapState = Awaited<
  ReturnType<InfoClient["webData2"]>
>["twapStates"][number][1];

export class HyperliquidClient extends Context.Service<
  HyperliquidClient,
  {
    readonly info: InfoClient;
  }
>()("HyperliquidClient") {}
