import { Effect, Option, Schema } from "effect";
import { asHttpError, type HttpError } from "../error-response";
import { parseOptionalSigFigsParam } from "../utils/param-parsers";
import { MarketTimeframeSchema, type MarketTimeframe } from "../../../domain/market-data/timeframe";

// Absent optional value: built through Option so the absence is explicit.
const noDate = Option.getOrUndefined(Option.none<Date>());
const noNumber = Option.getOrUndefined(Option.none<number>());

const badRequest = (message: string): Effect.Effect<never, HttpError> =>
  Effect.fail({ status: 400, message });

export const parseRequiredString = (
  params: URLSearchParams,
  key: string,
): Effect.Effect<string, HttpError> => {
  const value = params.get(key)?.trim();
  if (value === undefined || value === "") {
    return badRequest(`Missing required query parameter: ${key}`);
  }
  return Effect.succeed(value);
};

export const parseOptionalDate = (
  params: URLSearchParams,
  key: string,
): Effect.Effect<Date | undefined, HttpError> => {
  const value = params.get(key);
  if (value === null || value === "") {
    return Effect.succeed(noDate);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return badRequest(`Invalid date for ${key}: ${value}`);
  }

  return Effect.succeed(parsed);
};

export const parseOptionalPositiveInt = (
  params: URLSearchParams,
  key: string,
): Effect.Effect<number | undefined, HttpError> => {
  const rawValue = params.get(key);
  if (rawValue === null || rawValue === "") {
    return Effect.succeed(noNumber);
  }

  const value = rawValue.trim();
  if (!/^[+-]?\d+$/.test(value)) {
    return badRequest(`Invalid integer for ${key}: ${rawValue}`);
  }

  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return badRequest(`Invalid integer for ${key}: ${rawValue}`);
  }

  return Effect.succeed(parsed);
};

export const parseOptionalSigFigs = (
  params: URLSearchParams,
  key: string,
): Effect.Effect<2 | 3 | 4 | 5 | null, HttpError> => {
  const value = parseOptionalSigFigsParam(params, key);
  if (value === null) {
    return badRequest(`Invalid ${key}: ${params.get(key)}. Supported values are 2, 3, 4, 5.`);
  }

  // undefined (not provided) → null (full precision default)
  return Effect.succeed(value ?? null);
};

export const parseInterval = (
  params: URLSearchParams,
): Effect.Effect<MarketTimeframe, HttpError> => {
  const value = params.get("interval") ?? params.get("timeframe");
  if (value === null || value === "") {
    return badRequest("Missing required query parameter: interval");
  }
  return Schema.decodeUnknownEffect(MarketTimeframeSchema)(value).pipe(
    Effect.mapError(() => asHttpError(400, `Unsupported interval: ${value}`)),
  );
};
