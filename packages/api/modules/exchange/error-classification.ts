import { Effect, Match, Predicate } from "effect";
import { ValidationError, HttpRequestError, TransportError } from "@nktkas/hyperliquid";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import { ValiError, type BaseIssue, type BaseSchema } from "valibot";
import {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../shared/errors";

export type HlTif = "Gtc" | "Ioc" | "Alo" | "FrontendMarket";

// Hyperliquid's order schema accepts only these four TIF values; FOK has no
// equivalent, and mapping it to Gtc would turn a kill-or-nothing order into a
// resting order, so it must fail loudly instead.
const hlTifByOrderType: Record<string, HlTif> = {
  GTC: "Gtc",
  IOC: "Ioc",
  ALO: "Alo",
  Alo: "Alo",
  PostOnly: "Alo",
  FrontendMarket: "FrontendMarket",
  Market: "FrontendMarket",
};

export const toHlTif = (tif: string): Effect.Effect<HlTif, HyperliquidValidationError> => {
  const mapped = hlTifByOrderType[tif];
  if (mapped !== undefined) return Effect.succeed(mapped);
  const message =
    tif === "FOK"
      ? "FOK không được hỗ trợ bởi Hyperliquid: không có time-in-force fill-or-kill, từ chối thay vì hạ cấp thành lệnh chờ Gtc"
      : `Unsupported timeInForce: ${tif}`;
  return Effect.fail(new HyperliquidValidationError({ message, input: tif }));
};

const isValiError = (
  e: unknown,
): e is ValiError<BaseSchema<unknown, unknown, BaseIssue<unknown>>> => e instanceof ValiError;
const isValidationError = (e: unknown): e is ValidationError => e instanceof ValidationError;
const isApiRequestError = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError;
const isHttpOrTransportError = (e: unknown): e is HttpRequestError | TransportError =>
  e instanceof HttpRequestError || e instanceof TransportError;

const fieldText = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : undefined;

const getApiErrorMessage = (e: ApiRequestError): string => {
  const msg = e.message?.toLowerCase() ?? "";
  // SDK v0.33.0: ApiRequestError constructor is (response, message?).
  // When message is omitted, the message is stringified response.
  // Try to extract meaningful text from response if message is unhelpful.
  if (msg === "" || msg === "[object object]") {
    const resp = Predicate.isObject(e.response) ? e.response : null;
    if (resp !== null) {
      return (
        fieldText(resp.response) ??
        fieldText(resp.message) ??
        fieldText(resp.error) ??
        fieldText(resp.status) ??
        ""
      );
    }
  }
  return msg;
};

const classifyApiError = (e: ApiRequestError) => {
  const msg = getApiErrorMessage(e);
  return Match.value(true).pipe(
    Match.when(
      () => msg.includes("insufficient margin"),
      () => new InsufficientMarginError({ message: e.message }),
    ),
    Match.when(
      () => msg.includes("invalid") || msg.includes("size") || msg.includes("tick"),
      () => new HyperliquidValidationError({ message: e.message, cause: e }),
    ),
    Match.orElse(() => new HyperliquidInternalError({ message: e.message, cause: e })),
  );
};

export const classifyExchangeError = (
  e: unknown,
): HyperliquidValidationError | InsufficientMarginError | HyperliquidInternalError =>
  Match.value(e).pipe(
    Match.when(
      isValiError,
      (v) => new HyperliquidValidationError({ message: v.message, cause: v }),
    ),
    Match.when(
      isValidationError,
      (v) => new HyperliquidValidationError({ message: v.message, cause: v.cause }),
    ),
    Match.when(isApiRequestError, (v) => classifyApiError(v)),
    Match.when(
      isHttpOrTransportError,
      (v) => new HyperliquidInternalError({ message: v.message, cause: v }),
    ),
    Match.orElse(
      (unknownError) =>
        new HyperliquidInternalError({
          message: unknownError instanceof Error ? unknownError.message : String(unknownError),
          cause: unknownError instanceof Error ? unknownError : undefined,
        }),
    ),
  );
