import { Context, type Effect } from "effect";
import type {
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "@0xsignal/shared";
import type { ExchangeError } from "./errors";

export type { ExchangeError } from "./errors";

export class ExchangeService extends Context.Service<
  ExchangeService,
  {
    readonly placeOrder: (
      params: PlaceOrderRequest,
      userId: string,
    ) => Effect.Effect<unknown, ExchangeError>;
    readonly updateLeverageAndMargin: (
      params: UpdateLeverageRequest,
      userId: string,
    ) => Effect.Effect<unknown, ExchangeError>;
    readonly cancelOrders: (
      params: CancelOrdersRequest,
      userId: string,
    ) => Effect.Effect<unknown, ExchangeError>;
  }
>()("ExchangeService") {}

export { ExchangeCredentials, type ResolvedExchangeCredentials } from "./credentials";
