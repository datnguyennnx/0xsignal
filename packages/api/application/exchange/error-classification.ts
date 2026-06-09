import { Match } from "effect";
import { ValidationError, HttpRequestError, TransportError } from "@nktkas/hyperliquid";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import { ValiError } from "valibot";
import {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../domain/errors";

export const toHlTif = (tif: string): "Gtc" | "Ioc" | "Alo" | "FrontendMarket" => {
  const map: Record<string, "Gtc" | "Ioc" | "Alo" | "FrontendMarket"> = {
    GTC: "Gtc",
    IOC: "Ioc",
    FOK: "Gtc",
    Alo: "Alo",
    FrontendMarket: "FrontendMarket",
  };
  return map[tif] ?? "Gtc";
};

const isValiError = (e: unknown): e is ValiError<any> => e instanceof ValiError;
const isValidationError = (e: unknown): e is ValidationError => e instanceof ValidationError;
const isApiRequestError = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError;
const isHttpOrTransportError = (e: unknown): e is HttpRequestError | TransportError =>
  e instanceof HttpRequestError || e instanceof TransportError;

const classifyApiError = (e: ApiRequestError) => {
  const msg = e.message.toLowerCase();
  return Match.value(true).pipe(
    Match.when(
      () => msg.includes("insufficient margin"),
      () => new InsufficientMarginError({ message: e.message })
    ),
    Match.when(
      () => msg.includes("invalid") || msg.includes("size") || msg.includes("tick"),
      () => new HyperliquidValidationError({ message: e.message, cause: e })
    ),
    Match.orElse(() => new HyperliquidInternalError({ message: e.message, cause: e }))
  );
};

export const classifyExchangeError = (
  e: unknown
): HyperliquidValidationError | InsufficientMarginError | HyperliquidInternalError =>
  Match.value(e).pipe(
    Match.when(
      isValiError,
      (v) => new HyperliquidValidationError({ message: v.message, cause: v })
    ),
    Match.when(
      isValidationError,
      (v) => new HyperliquidValidationError({ message: v.message, cause: v.cause })
    ),
    Match.when(isApiRequestError, (v) => classifyApiError(v)),
    Match.when(
      isHttpOrTransportError,
      (v) => new HyperliquidInternalError({ message: v.message, cause: v })
    ),
    Match.orElse(
      (e) =>
        new HyperliquidInternalError({
          message: e instanceof Error ? e.message : String(e),
          cause: e instanceof Error ? e : undefined,
        })
    )
  );
