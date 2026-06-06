import { Context, type Effect } from "effect";
import type {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../domain/errors";
import type { PlaceOrderRequest, UpdateLeverageRequest, CancelOrdersRequest } from "./types";
import type {
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  EncryptionFailed,
} from "@0xsignal/auth";

export type ExchangeError =
  | HyperliquidValidationError
  | InsufficientMarginError
  | HyperliquidInternalError
  | AccountNotFound
  | CredentialNotFound
  | CredentialRevoked
  | CredentialExpired
  | CredentialUnverified
  | EncryptionFailed;

export class ExchangeService extends Context.Service<
  ExchangeService,
  {
    readonly placeOrder: (
      params: PlaceOrderRequest,
      userId: string
    ) => Effect.Effect<unknown, ExchangeError>;
    readonly updateLeverageAndMargin: (
      params: UpdateLeverageRequest,
      userId: string
    ) => Effect.Effect<unknown, ExchangeError>;
    readonly cancelOrders: (
      params: CancelOrdersRequest,
      userId: string
    ) => Effect.Effect<unknown, ExchangeError>;
  }
>()("ExchangeService") {}
