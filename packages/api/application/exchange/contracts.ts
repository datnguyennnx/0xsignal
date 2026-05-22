import { Context, type Effect } from "effect";
import type {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../domain/errors";
import type { PlaceOrderRequest, UpdateLeverageRequest, CancelOrdersRequest } from "./types";

export type ExchangePlaceOrderError =
  | HyperliquidValidationError
  | InsufficientMarginError
  | HyperliquidInternalError;

export type ExchangeSimpleError =
  | HyperliquidValidationError
  | InsufficientMarginError
  | HyperliquidInternalError;

export class ExchangeService extends Context.Tag("ExchangeService")<
  ExchangeService,
  {
    readonly placeOrder: (
      params: PlaceOrderRequest
    ) => Effect.Effect<unknown, ExchangePlaceOrderError>;
    readonly updateLeverageAndMargin: (
      params: UpdateLeverageRequest
    ) => Effect.Effect<unknown, ExchangeSimpleError>;
    readonly cancelOrders: (
      params: CancelOrdersRequest
    ) => Effect.Effect<unknown, ExchangeSimpleError>;
  }
>() {}
