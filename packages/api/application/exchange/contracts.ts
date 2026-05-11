import { Context, type Effect } from "effect";
import type {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../domain/errors";

export type ExchangePlaceOrderError =
  | HyperliquidValidationError
  | InsufficientMarginError
  | HyperliquidInternalError;

export type ExchangeSimpleError =
  | HyperliquidValidationError
  | InsufficientMarginError
  | HyperliquidInternalError;

export class ExchangeServices extends Context.Tag("ExchangeServices")<
  ExchangeServices,
  {
    readonly placeOrder: (params: {
      orders: Array<{
        a: number;
        b: boolean;
        p: string;
        s: string;
        r: boolean;
        t:
          | { limit: { tif: "Gtc" | "Ioc" | "Alo" | "FrontendMarket" } }
          | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
      }>;
      grouping?: "na" | "normalTpsl" | "positionTpsl";
    }) => Effect.Effect<unknown, ExchangePlaceOrderError>;
    readonly updateLeverageAndMargin: (params: {
      asset: number;
      isCross: boolean;
      leverage: number;
    }) => Effect.Effect<unknown, ExchangeSimpleError>;
    readonly cancelOrders: (params: {
      cancels: Array<{ coin: string; o: number }>;
    }) => Effect.Effect<unknown, ExchangeSimpleError>;
  }
>() {}
